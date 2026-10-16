import type { Experimental_CompositionEvaluator } from '@json-render/core'
import { expect, test, vi } from 'vitest'

import { composerValueUpdates } from '../app/utils/composerValues'
import {
    composeAdmin,
    inputChoices,
    selectedDate,
    type ComposerAdmin,
    type ComposerModelInfo,
} from '../server/ai/adminComposer'
import {
    composerModels,
    composerRequest,
    defaultComposerSpec,
    validComposerSpec,
    type ComposerEvent,
    type ComposerRequest,
} from '../shared/utils/adminComposer'
import config from '../site-admin.config'

const models: ComposerModelInfo[] = composerModels.map((name) => ({
    name,
    label: config.models[name].meta.label,
    displayField: config.models[name].displayFields.title,
    scheduling: !('scheduling' in config.models[name]) || config.models[name].scheduling !== false,
    fields: Object.entries(config.models[name].fields)
        .filter(([key, field]) =>
            name === 'posts' ? ['title', 'tags'].includes(key) : field.kind !== 'object',
        )
        .map(([key, field]) => ({
            key,
            kind: field.kind,
            label: typeof field.label === 'string' ? field.label : key,
            required: field.required,
            hasDefault: 'default' in field && field.default !== undefined,
            values: 'values' in field ? field.values : undefined,
        })),
}))
const input: ComposerRequest = {
    prompt: '記事「テスト」を作成',
    locale: 'ja',
    timeZone: 'Asia/Tokyo',
}
const makeAdmin = (): ComposerAdmin => ({
    models,
    list: vi.fn(async () => ({ items: [], total: 0 })),
    get: vi.fn(async () => ({ id: 'entry-1', data: { title: 'Existing', label: 'Existing' } })),
})
function evaluator(overrides: Record<string, string> | Record<string, string>[] = {}) {
    let round = 0
    return vi.fn<Experimental_CompositionEvaluator>(async ({ questions, state }) => {
        const values = Array.isArray(overrides)
            ? overrides[Math.min(round++, overrides.length - 1)]!
            : overrides
        expect(Object.keys(questions).length).toBeLessThanOrEqual(64)
        return {
            answers: Object.fromEntries(
                Object.entries(questions).map(([key, question]) => {
                    expect(key).toMatch(/^[A-Za-z0-9_.-]{1,100}$/)
                    expect(Object.keys(question.criteria).length).toBeGreaterThanOrEqual(2)
                    expect(Object.keys(question.criteria).length).toBeLessThanOrEqual(255)
                    const value = values[key]
                    const choice =
                        value === undefined
                            ? Object.keys(question.criteria)[0]!
                            : Object.hasOwn(question.criteria, value)
                              ? value
                              : (Object.entries(question.criteria).find(
                                    ([id, description]) =>
                                        description === value || state.values?.[id] === value,
                                )?.[0] ?? ('fill' in question.criteria ? 'fill' : undefined))
                    if (!choice) throw Error('Unoffered test choice: ' + key + '=' + value)
                    return [key, { choice }]
                }),
            ),
        }
    })
}
async function collect(
    request = input,
    evaluate = evaluator({ model: 'posts' }),
    admin = makeAdmin(),
    signal = new AbortController().signal,
) {
    const events: ComposerEvent[] = []
    for await (const event of composeAdmin(
        request,
        admin,
        evaluate,
        signal,
        Date.parse('2026-10-16T03:00:00Z'),
    ))
        events.push(event)
    return events
}
function getPlan(events: ComposerEvent[]) {
    const event = events.find((event) => event.type === 'plan')!
    if (event.type !== 'plan') throw Error('Missing plan')
    return event.plan
}

test('all configured models are available and input boundaries validate selection and context', () => {
    expect([...composerModels].sort()).toEqual(Object.keys(config.models).sort())
    for (const value of [
        { prompt: 'x'.repeat(2001) },
        { timeZone: 'not/a-zone' },
        { entryId: '1' },
        { model: 'users' },
        { context: { model: 'users' } },
    ])
        expect(composerRequest.safeParse({ ...input, ...value }).success).toBe(false)
})

test('facts preserve quotes, whole prose, URL components and account alternatives', () => {
    const values = inputChoices('作品「春の庭」を https://x.com/Liry24g に追加', 'ja')
    for (const value of ['春の庭', 'https://x.com/Liry24g', 'x', 'Liry24g', '@Liry24g'])
        expect(values).toContain(value)
    expect(values.length).toBeLessThanOrEqual(40)
    expect(inputChoices('A description longer than four words can remain intact', 'en')).toContain(
        'A description longer than four words can remain intact',
    )
})

test.each(composerModels)(
    '%s creation considers all models and completes in one inference',
    async (model) => {
        const evaluate = evaluator({ model })
        const admin = makeAdmin()
        const events = await collect(
            { ...input, context: { model: model === 'posts' ? 'works' : 'posts' } },
            evaluate,
            admin,
        )
        const plan = getPlan(events)
        expect(plan).toMatchObject({
            model,
            intent: 'create',
            datePurpose: 'none',
            dateIncomplete: false,
        })
        expect(evaluate).toHaveBeenCalledTimes(1)
        expect(Object.keys(evaluate.mock.calls[0]![0].questions)).toHaveLength(
            composerModels.length + 4,
        )
        expect(
            Object.keys(evaluate.mock.calls[0]![0].questions).some((key) =>
                key.startsWith('field.'),
            ),
        ).toBe(false)
        expect(admin.list).not.toHaveBeenCalled()
        expect(
            evaluate.mock.calls[0]![0].state.models.map((item: ComposerModelInfo) => item.name),
        ).toEqual(composerModels)
        expect(
            Object.keys(evaluate.mock.calls[0]![0].questions).some((key) =>
                key.startsWith('date.'),
            ),
        ).toBe(false)
        expect(plan.visibleFields).toEqual(
            plan.fields
                .filter((field) => field.required && !field.hasDefault)
                .map((field) => field.key),
        )
        expect(validComposerSpec(defaultComposerSpec(plan), plan)).toBe(true)
        expect(events.at(-1)).toMatchObject({ type: 'complete', fallback: false })
    },
)

test('a plain article request shows only the title, with no tags, schedule or date warning', async () => {
    const plan = getPlan(await collect())
    expect(plan.visibleFields).toEqual(['title'])
    expect(Object.keys(defaultComposerSpec(plan).elements)).toEqual(['panel', 'title', 'action'])
    expect(plan.dateIncomplete).toBe(false)
})

test('URL facts can prepare a new social after a complete empty lookup', async () => {
    const admin = makeAdmin()
    const evaluate = evaluator([
        {
            model: 'socials',
            intent: 'resolve',
            'query.socials': 'Liry24g',
            'field.href': 'https://x.com/Liry24g',
            'field.label': '@Liry24g',
            'field.icon': 'simple-icons:x',
        },
        {
            model: 'socials',
            intent: 'create',
            'field.href': 'https://x.com/Liry24g',
            'field.label': '@Liry24g',
            'field.icon': 'simple-icons:x',
        },
    ])
    const plan = getPlan(
        await collect({ ...input, prompt: 'https://x.com/Liry24g' }, evaluate, admin),
    )
    expect(plan).toMatchObject({
        model: 'socials',
        intent: 'create',
        values: {
            href: 'https://x.com/Liry24g',
            label: '@Liry24g',
            icon: 'simple-icons:x',
        },
    })
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(admin.list).toHaveBeenCalledWith('socials', 'Liry24g', expect.any(AbortSignal))
    expect(evaluate.mock.calls[1]![0].state.lookup).toMatchObject([{ complete: true, total: 0 }])
})

test.each(composerModels)(
    '%s can resolve an existing identity and prepare editing',
    async (model) => {
        const admin = makeAdmin()
        vi.mocked(admin.list).mockResolvedValue({
            items: [{ id: 'existing', data: { title: 'テスト' } }],
            total: 1,
        })
        const evaluate = evaluator([
            { model, intent: 'edit', lookup: 'model', ['query.' + model]: 'テスト' },
            { model, intent: 'edit', entry: 'existing' },
        ])
        const plan = getPlan(await collect(input, evaluate, admin))
        expect(plan).toMatchObject({ model, intent: 'edit', entryId: 'existing' })
        expect(evaluate).toHaveBeenCalledTimes(2)
        expect(admin.list).toHaveBeenCalledTimes(1)
    },
)

test('an explicit entry is fetched once, while screen context is only a hint', async () => {
    const admin = makeAdmin()
    const evaluate = evaluator({ model: 'works', intent: 'edit' })
    expect(
        getPlan(await collect({ ...input, model: 'socials', entryId: 'entry-1' }, evaluate, admin)),
    ).toMatchObject({ model: 'socials', intent: 'edit', entryId: 'entry-1' })
    expect(admin.get).toHaveBeenCalledWith('socials', 'entry-1')
    expect(admin.list).not.toHaveBeenCalled()
    expect(evaluate).toHaveBeenCalledTimes(1)
})

test('cross-model lookup preserves model identities and does not turn browsing into editing', async () => {
    const admin = makeAdmin()
    vi.mocked(admin.list).mockImplementation(async (model) => ({
        items: [{ id: model, data: { title: model } }],
        total: 1,
    }))
    const evaluate = evaluator([
        { model: 'clarify', intent: 'search', lookup: 'all' },
        { model: 'clarify', intent: 'search', entry: 'choose' },
    ])
    const plan = getPlan(await collect(input, evaluate, admin))
    expect(plan.intent).toBe('search')
    expect(plan.results.map((entry) => entry.model)).toEqual(composerModels)
    expect(admin.list).toHaveBeenCalledTimes(7)
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(Object.keys(defaultComposerSpec(plan).elements)).toEqual(['panel', 'results'])
})

test('an incomplete lookup cannot be treated as proof that a new identity is unregistered', async () => {
    const admin = makeAdmin()
    vi.mocked(admin.list).mockResolvedValue({ items: [], total: 8 })
    const plan = getPlan(
        await collect(
            input,
            evaluator([
                { model: 'works', intent: 'resolve' },
                { model: 'works', intent: 'create' },
            ]),
            admin,
        ),
    )
    expect(plan.intent).toBe('search')
    expect(plan.total).toBe(8)
})

test('lookup failures stop rather than silently preparing duplicates', async () => {
    const admin = makeAdmin()
    vi.mocked(admin.list).mockRejectedValue(Error('Lookup unavailable'))
    await expect(
        collect(input, evaluator({ model: 'works', intent: 'resolve' }), admin),
    ).rejects.toThrow('Lookup unavailable')
})

test('only a requested date adds a second inference; missing time stays incomplete', async () => {
    const decision = {
        model: 'posts',
        datePurpose: 'publication',
        'date.year': '2026',
        'date.month': '10',
        'date.day': '17',
        'date.hour': '18',
        'date.minute': '0',
    }
    const evaluate = evaluator(decision)
    const plan = getPlan(await collect({ ...input, prompt: '明日の18時に投稿を予約' }, evaluate))
    expect(plan).toMatchObject({
        publishAt: '2026-10-17T18:00',
        datePurpose: 'publication',
        dateIncomplete: false,
    })
    expect(plan.visibleFields).toEqual(['title'])
    expect(defaultComposerSpec(plan).elements.schedule).toBeDefined()
    expect(evaluate).toHaveBeenCalledTimes(2)
    const incomplete = getPlan(
        await collect(input, evaluator({ ...decision, 'date.hour': 'unchanged' })),
    )
    expect(incomplete).toMatchObject({ publishAt: '', dateIncomplete: true })
})

test('creation date and lookup are resolved together without a third inference', async () => {
    const evaluate = evaluator({
        model: 'works',
        intent: 'create',
        datePurpose: 'creation',
        'date.year': '2026',
        'date.month': '10',
        'date.day': '17',
        'date.hour': '18',
        'date.minute': '0',
    })
    const plan = getPlan(await collect(input, evaluate))
    expect(plan.values.createdAt).toBe('2026-10-17T09:00:00.000Z')
    expect(plan.visibleFields).toContain('createdAt')
    expect(evaluate).toHaveBeenCalledTimes(2)
})

test('date validation rejects impossible dates, past schedules and DST ambiguity', () => {
    const now = Date.parse('2026-10-16T03:00:00Z')
    expect(selectedDate(['2026', '2', '30', '12', '0'], 'Asia/Tokyo', now, false)).toBe('')
    expect(selectedDate(['2026', '10', '15', '12', '0'], 'Asia/Tokyo', now, true)).toBe('')
    expect(selectedDate(['2026', '3', '8', '2', '30'], 'America/New_York', 0, false)).toBe('')
    expect(selectedDate(['2026', '11', '1', '1', '30'], 'America/New_York', 0, false)).toBe('')
    expect(selectedDate(['2028', '2', '29', '12', '0'], 'Asia/Tokyo', now, true)).toBe(
        '2028-02-29T12:00',
    )
})

test('the spec rejects arbitrary actions, fields, cycles and missing chosen controls', async () => {
    const plan = getPlan(await collect())
    const original = defaultComposerSpec(plan)
    for (const mutate of [
        (spec: typeof original) => {
            spec.elements.title!.on = { press: { action: 'delete' } }
        },
        (spec: typeof original) => {
            spec.elements.title!.props = { name: 'password' }
        },
        (spec: typeof original) => {
            spec.elements.panel!.children!.push('title')
        },
        (spec: typeof original) => {
            spec.elements.panel!.children!.push('panel')
        },
        (spec: typeof original) => {
            delete spec.elements.title
        },
    ]) {
        const spec = structuredClone(original)
        mutate(spec)
        expect(validComposerSpec(spec, plan)).toBe(false)
    }
})

test('cancellation prevents reads or UI publication from a stale inference', async () => {
    const abort = new AbortController()
    const evaluate: Experimental_CompositionEvaluator = async (request) => {
        const result = await evaluator({ model: 'works', lookup: 'model' })(request)
        abort.abort()
        return result
    }
    const admin = makeAdmin()
    await expect(collect(input, evaluate, admin, abort.signal)).rejects.toMatchObject({
        name: 'AbortError',
    })
    expect(admin.list).not.toHaveBeenCalled()
})

test('new suggestions preserve fields edited by the user', () => {
    expect(
        composerValueUpdates(
            { title: 'My title', description: '', tags: ['vue'] },
            { title: 'Suggested', description: '', tags: ['vue'] },
            { title: 'New suggestion', description: 'Description', tags: ['nuxt'] },
        ),
    ).toEqual({ description: 'Description', tags: ['nuxt'] })
})

test('punctuation-only input still sends valid choice questions and asks for clarification', async () => {
    const plan = getPlan(
        await collect(
            { ...input, prompt: '🎨' },
            evaluator({ model: 'clarify', intent: 'clarify' }),
        ),
    )
    expect(plan.intent).toBe('clarify')
})

test('refinement retains explicitly supplied optional fields even if routing omitted them', async () => {
    const evaluate = evaluator([
        { model: 'ranks', intent: 'resolve', formDetails: 'resolve' },
        {
            model: 'ranks',
            intent: 'create',
            'field.game': 'VALORANT',
            'field.season': '2026 Act 2',
            'field.rank': 'Diamond',
        },
    ])
    const plan = getPlan(
        await collect(
            {
                ...input,
                prompt: 'ゲーム「VALORANT」、シーズン「2026 Act 2」、ランク「Diamond」を追加',
            },
            evaluate,
        ),
    )
    expect(plan.visibleFields).toContain('season')
    expect(plan.values).toMatchObject({ game: 'VALORANT', season: '2026 Act 2', rank: 'Diamond' })
})

test('management navigation shows only the action without an empty search result', async () => {
    const admin = makeAdmin()
    const evaluate = evaluator({ model: 'works', intent: 'manage' })
    const plan = getPlan(await collect(input, evaluate, admin))
    expect(Object.keys(defaultComposerSpec(plan).elements)).toEqual(['panel', 'action'])
    expect(admin.list).not.toHaveBeenCalled()
    expect(evaluate).toHaveBeenCalledTimes(1)
})

test.each([
    ['works', 'style', 'large'],
    ['arts', 'description', 'Artwork details'],
    ['careers', 'position', 'Engineer'],
    ['ranks', 'season', '2026 Act 2'],
    ['skills', 'category', 'Frontend'],
    ['socials', 'label', '@Liry24g'],
    ['posts', 'tags', 'nuxt'],
] as const)(
    '%s resolves supplied field values only after routing to that model',
    async (model, key, value) => {
        const evaluate = evaluator([
            { model, intent: 'create', formDetails: 'resolve' },
            { intent: 'create', ['field.' + key]: value },
        ])
        const admin = makeAdmin()
        const plan = getPlan(
            await collect({ ...input, prompt: `追加、${key}「${value}」` }, evaluate, admin),
        )
        expect(evaluate).toHaveBeenCalledTimes(2)
        expect(admin.list).not.toHaveBeenCalled()
        expect(plan.visibleFields).toContain(key)
        expect(plan.values[key]).toEqual(model === 'posts' ? [value] : value)
        const refined = evaluate.mock.calls[1]![0]
        expect(refined.state.models.map((item: ComposerModelInfo) => item.name)).toEqual([model])
        expect(
            Object.keys(refined.questions)
                .filter((name) => name.startsWith('field.'))
                .sort(),
        ).toEqual(
            models
                .find((item) => item.name === model)!
                .fields.filter((field) => field.key !== 'slug' && field.kind !== 'datetime')
                .map((field) => 'field.' + field.key)
                .sort(),
        )
        expect(Object.keys(refined.questions).some((name) => name.startsWith('query.'))).toBe(false)
        expect(refined.questions).not.toHaveProperty('formDetails')
        expect(refined.questions).not.toHaveProperty('model')
        expect(evaluate.mock.calls[0]![0].questions.intent!.criteria).toHaveProperty('resolve')
    },
)

test('a specifically requested optional field is shown even without a supplied value', async () => {
    const evaluate = evaluator([
        { model: 'works', intent: 'create', formDetails: 'resolve' },
        { intent: 'create', 'field.description': 'ask' },
    ])
    const plan = getPlan(
        await collect({ ...input, prompt: '作品を作成、説明も入力したい' }, evaluate),
    )
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(plan.visibleFields).toEqual(['title', 'description'])
    expect(plan.values).toEqual({})
    expect(plan.datePurpose).toBe('none')
})

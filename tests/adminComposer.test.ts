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
import { composeAdminRequest, composerSources } from '../server/ai/adminComposerBatch'
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

async function collectBatch(
    request: ComposerRequest,
    evaluate: Experimental_CompositionEvaluator,
    admin = makeAdmin(),
) {
    const events: ComposerEvent[] = []
    for await (const event of composeAdminRequest(
        request,
        admin,
        evaluate,
        new AbortController().signal,
        Date.parse('2026-10-16T03:00:00Z'),
    ))
        events.push(event)
    return events
}
const batchInput = { ...input, batch: true, requestId: 'request1' } as const
function getBatch(events: ComposerEvent[]) {
    const event = events.find((event) => event.type === 'batch')
    if (event?.type !== 'batch') throw new Error('Missing batch')
    return event.batch
}

test('new clients add only the count question for a single record', async () => {
    const evaluate = evaluator({ model: 'posts', itemCount: 'one' })
    const plan = getPlan(await collectBatch(batchInput, evaluate))
    expect(plan.visibleFields).toEqual(['title'])
    expect(evaluate).toHaveBeenCalledTimes(1)
    expect(Object.keys(evaluate.mock.calls[0]![0].questions)).toHaveLength(12)
    expect(evaluate.mock.calls[0]![0].questions.model!.criteria).toMatchObject({
        socials: expect.stringContaining('profile'),
        works: expect.stringContaining('products'),
        arts: expect.stringContaining('illustrations'),
        careers: expect.stringContaining('career'),
        skills: expect.stringContaining('knows'),
        ranks: expect.stringContaining('video games'),
        posts: expect.stringContaining('Blog'),
    })
})

test('an unknown profile service can supply an empty icon without schema changes', async () => {
    const evaluate = evaluator([
        { model: 'socials', intent: 'resolve', formDetails: 'resolve', 'query.socials': 'alice' },
        {
            intent: 'create',
            entry: 'none',
            'field.href': 'https://unknown.invalid/alice',
            'field.label': '@alice',
            'field.icon': 'empty',
        },
    ])
    const plan = getPlan(
        await collect({ ...input, prompt: 'https://unknown.invalid/alice' }, evaluate),
    )
    expect(plan.values).toEqual({
        href: 'https://unknown.invalid/alice',
        label: '@alice',
        icon: '',
    })
    expect(config.models.socials.fields.icon.required).toBe(true)
    const icons = Object.values(evaluate.mock.calls[1]![0].questions['field.icon']!.criteria)
    expect(evaluate.mock.calls[1]![0].questions['field.icon']!.criteria.empty).toContain('unknown')
    expect(icons).not.toContain('mingcute:link-fill')
})

test('mixed records share routing/refinement and keep each source and values separate', async () => {
    const prompt = 'https://x.com/alice\nスキル「Blender」を追加'
    const evaluate = evaluator([
        { itemCount: '2' },
        {
            'i0.source': 'https://x.com/alice',
            'i0.model': 'socials',
            'i0.intent': 'resolve',
            'i0.query': 'alice',
            'i0.formDetails': 'resolve',
            'i1.source': 'スキル「Blender」を追加',
            'i1.model': 'skills',
            'i1.intent': 'resolve',
            'i1.query': 'Blender',
            'i1.formDetails': 'resolve',
        },
        {
            'i0.intent': 'create',
            'i0.entry': 'none',
            'i0.field.href': 'https://x.com/alice',
            'i0.field.label': '@alice',
            'i0.field.icon': 'simple-icons:x',
            'i1.intent': 'create',
            'i1.entry': 'none',
            'i1.field.name': 'Blender',
            'i1.field.icon': 'simple-icons:blender',
        },
    ])
    const admin = makeAdmin()
    const batch = getBatch(await collectBatch({ ...batchInput, prompt }, evaluate, admin))
    expect(evaluate).toHaveBeenCalledTimes(3)
    expect(Object.keys(evaluate.mock.calls[1]![0].questions)).toHaveLength(12)
    expect(batch.items.map((item) => item.id)).toEqual(['request1.0', 'request1.1'])
    expect(batch.items.map((item) => item.plan?.model)).toEqual(['socials', 'skills'])
    expect(batch.items[0]?.plan?.values).toEqual({
        href: 'https://x.com/alice',
        label: '@alice',
        icon: 'simple-icons:x',
    })
    expect(batch.items[1]?.plan?.values).toMatchObject({
        name: 'Blender',
        icon: 'simple-icons:blender',
    })
    expect(prompt.slice(batch.items[1]!.source.start, batch.items[1]!.source.end)).toBe(
        'スキル「Blender」を追加',
    )
    expect(admin.list).toHaveBeenCalledTimes(2)
    expect(evaluate.mock.calls[2]![0].state.items.i0.request).toBe('https://x.com/alice')
    expect(evaluate.mock.calls[2]![0].state.items.i1.request).toBe('スキル「Blender」を追加')
})

test('ten detailed records split refinement into bounded groups with at most two concurrent evaluations', async () => {
    const sources = Array.from({ length: 10 }, (_, i) => `作品「Project${i}」を作成`)
    const grouped = Object.fromEntries(
        sources.flatMap((source, i) =>
            Object.entries({
                source,
                model: 'works',
                intent: 'resolve',
                query: 'Project' + i,
                formDetails: 'resolve',
            }).map(([key, value]) => [`i${i}.${key}`, value]),
        ),
    )
    const details = Object.fromEntries(
        sources.flatMap((_, i) => [
            [`i${i}.intent`, 'create'],
            [`i${i}.entry`, 'none'],
            [`i${i}.field.title`, 'Project' + i],
        ]),
    )
    const decide = evaluator([{ itemCount: '10' }, grouped, details])
    let concurrent = 0,
        maximum = 0
    const evaluate: Experimental_CompositionEvaluator = async (request) => {
        concurrent++
        maximum = Math.max(maximum, concurrent)
        try {
            await new Promise((resolve) => setTimeout(resolve, 5))
            return await decide(request)
        } finally {
            concurrent--
        }
    }
    const batch = getBatch(
        await collectBatch({ ...batchInput, prompt: sources.join('\n') }, evaluate),
    )
    expect(batch.items).toHaveLength(10)
    expect(batch.items.map((item) => item.plan?.values.title)).toEqual(
        sources.map((_, i) => 'Project' + i),
    )
    expect(maximum).toBe(2)
    expect(Object.keys(decide.mock.calls[1]![0].questions)).toHaveLength(60)
    for (const [request] of decide.mock.calls)
        expect(Object.keys(request.questions).length).toBeLessThanOrEqual(64)
})

test.each(['unclear', 'overflow'])(
    'ambiguous or excessive record count returns guidance, never a truncated batch (%s)',
    async (itemCount) => {
        const evaluate = evaluator({ itemCount })
        const admin = makeAdmin()
        const batch = getBatch(await collectBatch(batchInput, evaluate, admin))
        expect(batch.items).toEqual([])
        expect(batch.notice).toBeTruthy()
        expect(evaluate).toHaveBeenCalledTimes(1)
        expect(admin.list).not.toHaveBeenCalled()
    },
)

test('an explicit model selection resolves only that source with stable identity and add intent', async () => {
    const prompt = '不明な項目\nもう一つ'
    const evaluate = evaluator({ model: 'posts', intent: 'create' })
    const item = {
        id: 'request1.1',
        source: { start: 6, end: prompt.length },
        model: 'skills' as const,
    }
    const batch = getBatch(await collectBatch({ ...batchInput, prompt, items: [item] }, evaluate))
    expect(batch.items[0]).toMatchObject({ ...item, plan: { model: 'skills', intent: 'create' } })
    expect(evaluate).toHaveBeenCalledTimes(1)
    const request = evaluate.mock.calls[0]![0]
    expect(request.state.request).toBe(prompt.slice(6))
    expect(request.questions.itemCount).toBeUndefined()
    expect(request.questions.intent!.criteria.search).toBeUndefined()
})

test('batch errors stay local and matching existing entries are not automatically changed', async () => {
    const request = {
        ...batchInput,
        prompt: 'first\nsecond',
        items: [
            { id: 'request1.0', source: { start: 0, end: 5 }, model: 'works' as const },
            { id: 'request1.1', source: { start: 6, end: 12 }, model: 'skills' as const },
        ],
    }
    const admin = makeAdmin()
    vi.mocked(admin.list).mockImplementation(async (model) => {
        if (model === 'skills') throw new Error('synthetic failure')
        return { items: [{ id: 'exists', data: { title: 'first' } }], total: 1 }
    })
    const evaluate = evaluator([{ intent: 'resolve' }, { intent: 'edit', entry: 'exists' }])
    const batch = getBatch(await collectBatch(request, evaluate, admin))
    expect(batch.items[0]?.plan).toMatchObject({
        intent: 'search',
        values: {},
        results: [{ id: 'exists' }],
    })
    expect(batch.items[1]?.error).toBeTruthy()
})

test('batch input validates source ranges, identities and selection dependencies', () => {
    const valid = {
        ...batchInput,
        items: [{ id: 'request1.0', source: { start: 0, end: input.prompt.length } }],
    }
    expect(composerRequest.safeParse(valid).success).toBe(true)
    for (const item of [
        { id: 'other.0', source: { start: 0, end: 1 } },
        { id: 'request1.10', source: { start: 0, end: 1 } },
        { id: 'request1.0', source: { start: 2, end: 1 } },
        { id: 'request1.0', source: { start: 0, end: 2000 } },
        { id: 'request1.0', source: { start: 0, end: 1 }, entryId: 'existing' },
    ])
        expect(composerRequest.safeParse({ ...valid, items: [item] }).success).toBe(false)
    expect(
        composerRequest.safeParse({ ...valid, items: [valid.items[0], valid.items[0]] }).success,
    ).toBe(false)
    expect(composerRequest.safeParse({ ...valid, batch: undefined }).success).toBe(false)
    const prompt = Array.from({ length: 80 }, (_, i) => `作品${i}`).join('\n')
    expect(composerSources(prompt).at(-2)!.end).toBeGreaterThan(40)
})

test('explicit blank copies remain separate records even with the same source', async () => {
    const evaluate = evaluator([
        { itemCount: '2' },
        {
            'i0.source': '記事を2件作成',
            'i0.model': 'posts',
            'i0.intent': 'create',
            'i0.query': 'none',
            'i1.source': '記事を2件作成',
            'i1.model': 'posts',
            'i1.intent': 'create',
            'i1.query': 'none',
        },
    ])
    const batch = getBatch(await collectBatch({ ...batchInput, prompt: '記事を2件作成' }, evaluate))
    expect(batch.items.map((item) => item.plan?.intent)).toEqual(['create', 'create'])
    expect(batch.items[0]!.source).toEqual(batch.items[1]!.source)
    expect(batch.items[0]!.id).not.toBe(batch.items[1]!.id)
    expect(evaluate).toHaveBeenCalledTimes(2)
})

test('a duplicated profile in one batch requires correction instead of two creates', async () => {
    const evaluate = evaluator([
        { itemCount: '2' },
        {
            'i0.model': 'socials',
            'i0.intent': 'resolve',
            'i0.query': 'alice',
            'i0.formDetails': 'resolve',
            'i1.model': 'socials',
            'i1.intent': 'resolve',
            'i1.query': 'alice',
            'i1.formDetails': 'resolve',
        },
        Object.fromEntries(
            [0, 1].flatMap((i) =>
                Object.entries({
                    intent: 'create',
                    entry: 'none',
                    'field.href': 'https://x.com/alice',
                    'field.label': '@alice',
                    'field.icon': 'simple-icons:x',
                }).map(([key, value]) => [`i${i}.${key}`, value]),
            ),
        ),
    ])
    const batch = getBatch(
        await collectBatch({ ...batchInput, prompt: 'https://x.com/alice' }, evaluate),
    )
    expect(batch.items[0]?.plan?.intent).toBe('create')
    expect(batch.items[1]?.plan).toBeUndefined()
    expect(batch.items[1]?.error).toContain('重複')
})

test('single requests keep a short deadline while multiple-item refinement can take longer', async () => {
    vi.useFakeTimers()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
        const controller = new AbortController()
        setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms)
        return controller.signal
    })
    try {
        const decide = evaluator([
            { itemCount: '2' },
            {
                'i0.source': '「First」',
                'i0.model': 'works',
                'i0.intent': 'create',
                'i0.formDetails': 'resolve',
                'i1.source': '「Second」',
                'i1.model': 'works',
                'i1.intent': 'create',
                'i1.formDetails': 'resolve',
            },
            {
                'i0.intent': 'create',
                'i0.field.title': 'First',
                'i1.intent': 'create',
                'i1.field.title': 'Second',
            },
        ])
        const pending = collectBatch(
            { ...batchInput, prompt: '「First」\n「Second」' },
            async (request) => {
                if (Object.keys(request.questions).some((key) => key.includes('.field.')))
                    await new Promise((resolve) => setTimeout(resolve, 6000))
                return decide(request)
            },
        )
        await vi.advanceTimersByTimeAsync(6001)
        const batch = getBatch(await pending)
        expect(batch.items.map((item) => item.plan?.values.title)).toEqual(['First', 'Second'])
        const single = collectBatch(batchInput, async (request) => {
            await new Promise((resolve) => setTimeout(resolve, 6000))
            return evaluator({ model: 'posts' })(request)
        })
        const rejected = expect(single).rejects.toMatchObject({ name: 'TimeoutError' })
        await vi.advanceTimersByTimeAsync(6001)
        await rejected
    } finally {
        timeout.mockRestore()
        vi.useRealTimers()
    }
})

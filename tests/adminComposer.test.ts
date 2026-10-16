import type { Experimental_CompositionEvaluator } from '@json-render/core'
import { expect, test, vi } from 'vitest'

import { composerValueUpdates } from '../app/utils/composerValues'
import {
    composeAdmin,
    inputChoices,
    selectedDate,
    type ComposerAdmin,
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

const input: ComposerRequest = {
    prompt: 'Social link https://github.com/liry24',
    locale: 'ja',
    timeZone: 'Asia/Tokyo',
}
const admin: ComposerAdmin = {
    models: [
        {
            name: 'socials',
            fields: [
                { key: 'href', label: 'URL', kind: 'url', required: true },
                { key: 'label', label: 'Label', kind: 'text', required: true },
                { key: 'icon', label: 'Icon', kind: 'text', required: true },
            ],
        },
        {
            name: 'posts',
            fields: [
                { key: 'title', label: 'Title', kind: 'text', required: true },
                { key: 'tags', label: 'Tags', kind: 'array', required: true },
            ],
        },
    ],
    list: vi.fn(async () => ({
        items: [{ id: 'entry-1', data: { label: 'Existing' } }],
        total: 8,
    })),
    get: vi.fn(async () => ({ id: 'entry-1', data: { label: 'Existing' } })),
}
const evaluate =
    (
        overrides: Record<string, string> = {},
        omitRequired = false,
    ): Experimental_CompositionEvaluator =>
    async ({ questions }) => ({
        answers: Object.fromEntries(
            Object.entries(questions).map(([key, question]) => {
                let choice = Object.keys(question.criteria)[0]!
                if (key === 'intent')
                    choice = Object.entries(question.criteria).find(
                        ([, value]) => value === 'create',
                    )![0]
                if (key.startsWith('select_'))
                    choice =
                        Object.keys(question.criteria).find(
                            (value) => value.startsWith('use:') && value !== 'use:group',
                        ) ?? 'omit'
                if (key.startsWith('order_')) choice = '1'
                if (key in overrides)
                    choice =
                        Object.entries(question.criteria).find(
                            ([, value]) => value === overrides[key],
                        )?.[0] ?? overrides[key]!
                if (omitRequired && key.startsWith('select_')) choice = 'omit'
                return [key, { choice }]
            }),
        ),
    })
async function collect(
    request = input,
    evaluator = evaluate(),
    signal = new AbortController().signal,
) {
    const events: ComposerEvent[] = []
    for await (const event of composeAdmin(
        request,
        admin,
        evaluator,
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
test('all configured content models are included, input boundaries reject unsupported scope', () => {
    expect([...composerModels].sort()).toEqual(Object.keys(config.models).sort())
    expect(composerRequest.safeParse({ ...input, prompt: 'x'.repeat(2001) }).success).toBe(false)
    expect(composerRequest.safeParse({ ...input, timeZone: 'not/a-zone' }).success).toBe(false)
    expect(composerRequest.safeParse({ ...input, entryId: '1' }).success).toBe(false)
    expect(composerRequest.safeParse({ ...input, model: 'users' }).success).toBe(false)
})
test('input spans preserve quoted prose, URLs and Unicode without deciding intent', () => {
    const choices = inputChoices('作品「春の庭」を https://example.com/art に追加', 'ja')
    expect(choices).toContain('春の庭')
    expect(choices).toContain('https://example.com/art')
    expect(choices.length).toBeLessThanOrEqual(64)
})
test('decision-only creation supplies initial values and completes a bounded catalog spec', async () => {
    const spy = vi.fn(
        evaluate({
            'field:href': 'https://github.com/liry24',
            'field:icon': 'simple-icons:github',
        }),
    )
    const events = await collect(input, spy)
    const plan = getPlan(events)
    expect(plan.values).toEqual({ href: 'https://github.com/liry24', icon: 'simple-icons:github' })
    expect(events.at(-1)).toMatchObject({ type: 'complete', fallback: false })
    expect(spy).toHaveBeenCalledTimes(3)
    const last = events.at(-1)!
    if (last.type === 'complete') expect(validComposerSpec(last.spec, plan)).toBe(true)
})
test('missing required controls fall back to the complete regular field set', async () => {
    const events = await collect(input, evaluate({}, true))
    const last = events.at(-1)!
    expect(last).toMatchObject({ type: 'complete', fallback: true })
    if (last.type === 'complete') expect(validComposerSpec(last.spec, getPlan(events))).toBe(true)
})
test('search returns only entry summaries; edit fetches only the explicitly selected entry', async () => {
    const events = await collect(input, evaluate({ intent: 'edit', query: 'Social' }))
    expect(getPlan(events)).toMatchObject({
        intent: 'search',
        results: [{ id: 'entry-1', title: 'Existing' }],
        total: 8,
    })
    expect(admin.list).toHaveBeenLastCalledWith('socials', 'Social', expect.any(AbortSignal))
    const editEvents = await collect({ ...input, model: 'socials', entryId: 'entry-1' })
    expect(getPlan(editEvents)).toMatchObject({ intent: 'edit', entryId: 'entry-1' })
    expect(admin.get).toHaveBeenLastCalledWith('socials', 'entry-1')
})
test('model-selected relative dates are assembled in the user timezone; absent time remains incomplete', async () => {
    const decision = {
        model: 'posts',
        datePurpose: 'Publication schedule',
        'date:year': '2026',
        'date:month': '10',
        'date:day': '17',
        'date:hour': '18',
        'date:minute': '0',
    }
    const events = await collect({ ...input, prompt: '明日の18時に投稿を予約' }, evaluate(decision))
    expect(getPlan(events)).toMatchObject({ publishAt: '2026-10-17T18:00', dateIncomplete: false })
    const incomplete = await collect(
        { ...input, prompt: '明日に投稿' },
        evaluate({ ...decision, 'date:hour': 'Leave unchanged / ask the user' }),
    )
    expect(getPlan(incomplete)).toMatchObject({ publishAt: '', dateIncomplete: true })
})
test('date validation rejects impossible dates, past schedules, DST gaps and ambiguous times', () => {
    const past = Date.parse('2026-10-16T03:00:00Z')
    expect(selectedDate(['2026', '2', '30', '12', '0'], 'Asia/Tokyo', past, false)).toBe('')
    expect(selectedDate(['2026', '10', '15', '12', '0'], 'Asia/Tokyo', past, true)).toBe('')
    expect(selectedDate(['2026', '3', '8', '2', '30'], 'America/New_York', 0, false)).toBe('')
    expect(selectedDate(['2026', '11', '1', '1', '30'], 'America/New_York', 0, false)).toBe('')
    expect(selectedDate(['2028', '2', '29', '12', '0'], 'Asia/Tokyo', past, true)).toBe(
        '2028-02-29T12:00',
    )
})
test('spec validation rejects injected actions, unknown fields, duplicates, cycles and missing required fields', async () => {
    const plan = getPlan(await collect())
    const original = defaultComposerSpec(plan)
    for (const mutate of [
        (spec: typeof original) => {
            spec.elements.href!.on = { press: { action: 'delete' } }
        },
        (spec: typeof original) => {
            spec.elements.href!.props = { name: 'password' }
        },
        (spec: typeof original) => {
            spec.elements.panel!.children!.push('href')
        },
        (spec: typeof original) => {
            spec.elements.panel!.children!.push('panel')
        },
        (spec: typeof original) => {
            spec.elements.panel!.children = ['action']
            delete spec.elements.href
            delete spec.elements.label
            delete spec.elements.icon
        },
    ]) {
        const spec = structuredClone(original)
        mutate(spec)
        expect(validComposerSpec(spec, plan)).toBe(false)
    }
})
test('cancellation stops composition before any UI event is returned', async () => {
    const abort = new AbortController()
    const evaluator: Experimental_CompositionEvaluator = async (request) => {
        const result = await evaluate()(request)
        abort.abort()
        return result
    }
    await expect(collect(input, evaluator, abort.signal)).rejects.toMatchObject({
        name: 'AbortError',
    })
})
test('new suggestions preserve fields the user has edited', () => {
    const baseline = { title: 'Suggested', description: '', tags: ['vue'] }
    expect(
        composerValueUpdates({ title: 'My title', description: '', tags: ['vue'] }, baseline, {
            title: 'New suggestion',
            description: 'Description',
            tags: ['nuxt'],
        }),
    ).toEqual({ description: 'Description', tags: ['nuxt'] })
})

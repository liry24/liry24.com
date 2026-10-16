import { parseDateTime, toZoned } from '@internationalized/date'
import {
    experimental_composeSpec,
    type Experimental_CompositionEvaluator,
    type Experimental_ChoiceQuestion,
} from '@json-render/core'

import type {
    ComposerEvent,
    ComposerField,
    ComposerModel,
    ComposerPlan,
    ComposerRequest,
} from '../../shared/utils/adminComposer'
import {
    composerCandidates,
    composerCatalog,
    defaultComposerSpec,
    validComposerSpec,
} from '../../shared/utils/adminComposer'

export type ComposerModelInfo = { name: ComposerModel; fields: ComposerField[] }
type Entry = { id: string; data: Record<string, unknown> }
export type ComposerAdmin = {
    models: ComposerModelInfo[]
    list: (
        model: ComposerModel,
        query: string,
        signal: AbortSignal,
    ) => Promise<{ items: Entry[]; total: number }>
    get: (model: ComposerModel, id: string) => Promise<Entry>
}
const question = (
    instructions: string,
    values: readonly string[],
): Experimental_ChoiceQuestion => ({
    type: 'choice',
    instructions,
    criteria: Object.fromEntries(values.map((value, index) => [`v${index}`, value])),
})

// Neutral spans are choices, not keyword-based intent or date interpretation.
export function inputChoices(prompt: string, locale: string): string[] {
    const words = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(prompt)].filter(
        (part) => part.isWordLike,
    )
    const spans = words.flatMap((word, index) =>
        [1, 2, 3, 4].map((count) => {
            const end = words[index + count - 1]
            return end ? prompt.slice(word.index, end.index + end.segment.length) : ''
        }),
    )
    const quotes = [...prompt.matchAll(/「([^」]+)」|“([^”]+)”|"([^"]+)"/gu)].map(
        (match) => match[1] || match[2] || match[3] || '',
    )
    const urls = [...prompt.matchAll(/https?:\/\/[^\s<>"「」]+/gu)].map((match) => match[0])
    const urlParts = urls.flatMap((value) => {
        try {
            return new URL(value).pathname.split('/').filter(Boolean)
        } catch {
            return []
        }
    })
    return [...new Set([...quotes, ...urls, ...urlParts, ...spans, prompt])]
        .filter((value) => value.length > 0 && value.length <= 200)
        .slice(0, 64)
}

export function selectedDate(
    parts: (string | undefined)[],
    timeZone: string,
    currentTime: number,
    future: boolean,
) {
    if (parts.some((part) => !part || part === 'Leave unchanged / ask the user')) return ''
    const [year, month, day, hour, minute] = parts
    const value = `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}T${hour!.padStart(2, '0')}:${minute!.padStart(2, '0')}`
    try {
        const instant = toZoned(parseDateTime(value), timeZone, 'reject').toDate().getTime()
        return !future || instant > currentTime ? value : ''
    } catch {
        return ''
    }
}

export async function* composeAdmin(
    input: ComposerRequest,
    admin: ComposerAdmin,
    evaluate: Experimental_CompositionEvaluator,
    signal: AbortSignal,
    currentTime = Date.now(),
): AsyncGenerator<ComposerEvent> {
    signal.throwIfAborted()
    const unchanged = 'Leave unchanged / ask the user'
    const existing =
        input.model && input.entryId ? await admin.get(input.model, input.entryId) : undefined
    signal.throwIfAborted()
    const existingValues = Object.fromEntries(
        (admin.models.find((model) => model.name === input.model)?.fields ?? [])
            .filter(
                (field) => !['image', 'images', 'file', 'object', 'markdown'].includes(field.kind),
            )
            .flatMap((field) => {
                const value = existing?.data[field.key]
                return typeof value === 'string' && value.length <= 200 ? [[field.key, value]] : []
            }),
    )
    const choices = [
        ...new Set([...inputChoices(input.prompt, input.locale), ...Object.values(existingValues)]),
    ].slice(0, 80)
    const questions: Record<string, Experimental_ChoiceQuestion> = {
        model: question(
            'Which content model does the request concern? Choose clarify if unclear.',
            [...admin.models.map((model) => model.name), 'clarify'],
        ),
        intent: question(
            'Choose create, search, edit, manage (publish/delete/history/reorder), settings, or clarify. Editing an unspecified entry requires searching first.',
            ['create', 'search', 'edit', 'manage', 'settings', 'clarify'],
        ),
        query: question(
            'Select the search term identifying the existing entry. Leave unchanged for all entries.',
            [unchanged, ...choices],
        ),
        datePurpose: question(
            'What is the requested date for? Publishing only supported for posts here. No date means unchanged.',
            [unchanged, 'Publication schedule', 'Creation date'],
        ),
    }
    const fields = [
        ...new Map(
            admin.models.flatMap((model) => model.fields).map((field) => [field.key, field]),
        ).values(),
    ]
    for (const field of fields) {
        if (['image', 'images', 'file', 'datetime'].includes(field.kind) || field.key === 'slug')
            continue
        const values =
            field.values ??
            (field.key === 'icon'
                ? [
                      ...choices,
                      'simple-icons:github',
                      'simple-icons:x',
                      'simple-icons:bluesky',
                      'simple-icons:discord',
                      'simple-icons:youtube',
                      'simple-icons:instagram',
                      'mingcute:link-fill',
                  ]
                : choices)
        questions[`field.${field.key}`] = question(
            `Select a value explicitly supported by the request for ${field.key}. Never invent prose. Fields unrelated to the requested model or missing information must be unchanged. For array fields select the full comma-separated list when present.`,
            [unchanged, ...values],
        )
    }
    const zonedNow = new Intl.DateTimeFormat('sv-SE', {
        timeZone: input.timeZone,
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(currentTime)
    const currentYear = Number(zonedNow.slice(0, 4))
    const existingYear =
        typeof existing?.data.createdAt === 'string'
            ? Number(existing.data.createdAt.slice(0, 4))
            : undefined
    const years = Array.from({ length: 21 }, (_, index) => String(currentYear - 10 + index))
    if (existingYear && !years.includes(String(existingYear))) years.push(String(existingYear))
    const dateOptions = { year: years, month: 12, day: 31, hour: 24, minute: 60 }
    for (const [part, range] of Object.entries(dateOptions)) {
        const values = Array.isArray(range)
            ? range
            : Array.from({ length: range }, (_, index) =>
                  String(index + (part === 'month' || part === 'day' ? 1 : 0)),
              )
        questions[`date.${part}`] = question(
            `Resolve the requested ${part} in the user's timezone, relative to the supplied current time. Choose unchanged when time is absent or ambiguous; do not invent a time. If an exact hour is requested, minute may be 0.`,
            [unchanged, ...values],
        )
    }
    const decision = await evaluate({
        state: {
            request: input.prompt,
            locale: input.locale,
            timeZone: input.timeZone,
            currentTime: zonedNow,
            selectedModel: input.model,
            selectedEntry: input.entryId,
            existingValues,
            models: admin.models.map((model) => ({
                name: model.name,
                fields: model.fields.map((field) => field.key),
            })),
        },
        questions,
        signal,
    })
    signal.throwIfAborted()
    const value = (key: string) => questions[key]!.criteria[decision.answers[key]!.choice]!
    const model =
        input.model ?? admin.models.find((model) => model.name === value('model'))?.name ?? null
    const info = admin.models.find((item) => item.name === model)
    const intent = input.entryId ? 'edit' : (value('intent') as ComposerPlan['intent'])
    const plan: ComposerPlan = {
        model,
        intent: !model && intent !== 'settings' ? 'clarify' : intent,
        entryId: input.entryId,
        fields: info?.fields ?? [],
        values: {},
        publishAt: '',
        timeZone: input.timeZone,
        dateIncomplete: false,
        query: value('query') === unchanged ? '' : value('query'),
        results: [],
        total: 0,
    }
    if (plan.intent === 'create' || (plan.intent === 'edit' && plan.entryId)) {
        for (const field of plan.fields) {
            const key = `field.${field.key}`
            if (!questions[key] || value(key) === unchanged) continue
            const proposed = value(key)
            if (field.kind === 'url') {
                try {
                    if (!['https:', 'http:'].includes(new URL(proposed).protocol)) continue
                } catch {
                    continue
                }
            }
            plan.values[field.key] =
                field.kind === 'array'
                    ? proposed
                          .split(/[,、\n]/u)
                          .map((value) => value.trim())
                          .filter(Boolean)
                    : proposed
        }
        const purpose = value('datePurpose')
        if (purpose !== unchanged) {
            const date = selectedDate(
                ['year', 'month', 'day', 'hour', 'minute'].map((part) => value(`date.${part}`)),
                input.timeZone,
                currentTime,
                purpose === 'Publication schedule',
            )
            plan.dateIncomplete = !date
            if (purpose === 'Publication schedule' && model === 'posts') plan.publishAt = date
            else if (
                purpose === 'Creation date' &&
                plan.fields.some((field) => field.key === 'createdAt') &&
                date
            )
                plan.values.createdAt = toZoned(
                    parseDateTime(date),
                    input.timeZone,
                    'reject',
                ).toAbsoluteString()
            else plan.dateIncomplete = true
        }
    } else if (model && plan.intent !== 'clarify' && plan.intent !== 'settings') {
        if (plan.intent === 'edit') plan.intent = 'search'
        const result = await admin.list(model, plan.query, signal)
        plan.results = result.items.map((entry) => ({
            id: entry.id,
            title: String(
                entry.data.title ??
                    entry.data.name ??
                    entry.data.company ??
                    entry.data.game ??
                    entry.data.label ??
                    entry.id,
            ),
        }))
        plan.total = result.total
    }
    signal.throwIfAborted()
    yield { type: 'plan', plan }
    if (plan.intent === 'clarify') {
        yield { type: 'complete', spec: defaultComposerSpec(plan), fallback: true }
        return
    }
    for await (const event of experimental_composeSpec({
        catalog: composerCatalog,
        candidates: composerCandidates(plan),
        prompt: input.prompt,
        evaluate,
        signal,
        strategy: 'batch',
        maxSteps: 2,
        maxElements: 24,
        maxDepth: 4,
        context: { intent: plan.intent, model, fieldsWithValues: Object.keys(plan.values) },
        instructions: {
            root: 'Use Panel.',
            next: 'Include all REQUIRED components and the final action. Include fields relevant to the request. Put related short fields together.',
            parent: 'Panel contains the form. Group contains short related fields. Action comes last.',
        },
    })) {
        signal.throwIfAborted()
        if (event.type === 'step' && validComposerSpec(event.spec, plan, false))
            yield { type: 'step', spec: event.spec }
        else if (event.type === 'complete') {
            const valid =
                event.spec && event.stopReason === 'finish' && validComposerSpec(event.spec, plan)
            yield {
                type: 'complete',
                spec: valid ? event.spec! : defaultComposerSpec(plan),
                fallback: !valid,
            }
        }
    }
}

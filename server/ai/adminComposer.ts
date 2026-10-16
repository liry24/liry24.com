import { parseDateTime, toZoned } from '@internationalized/date'
import type {
    Experimental_CompositionEvaluator,
    Experimental_ChoiceQuestion,
} from '@json-render/core'

import type {
    ComposerBatch,
    ComposerEvent,
    ComposerField,
    ComposerModel,
    ComposerPlan,
    ComposerRequest,
} from '../../shared/utils/adminComposer'
import { composerModelDescriptions, defaultComposerSpec } from '../../shared/utils/adminComposer'

export type ComposerModelInfo = {
    name: ComposerModel
    label?: string
    fields: ComposerField[]
    displayField?: string
    features?: Record<string, boolean>
    scheduling?: boolean
}
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
export const question = (
    instructions: string,
    criteria: Record<string, string>,
): Experimental_ChoiceQuestion => ({ type: 'choice', instructions, criteria })
export const options = (values: readonly string[]) =>
    Object.fromEntries([...new Set(values)].map((value, i) => ['v' + i, value]))

// Parsing supplies facts and alternatives; the model decides what they mean.
export function inputChoices(prompt: string, locale: string): string[] {
    const text = prompt.replace(/https?:\/\/[^\s<>"「」]+/gu, (url) => ' '.repeat(url.length))
    const words = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)].filter(
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
            const url = new URL(value)
            const parts = url.pathname
                .split('/')
                .filter(Boolean)
                .map((part) => {
                    try {
                        return decodeURIComponent(part)
                    } catch {
                        return part
                    }
                })
            return [
                url.hostname,
                ...url.hostname.split('.'),
                ...parts,
                ...parts.map((part) => '@' + part.replace(/^@/, '')),
            ]
        } catch {
            return []
        }
    })
    return [
        ...new Set([
            ...quotes,
            ...urls,
            ...urlParts,
            ...prompt.split(/[、,;；。\n]/u).map((part) => part.trim()),
            prompt,
            ...spans,
        ]),
    ]
        .filter((value) => value.length > 0 && value.length <= 2000)
        .slice(0, 40)
}

export const inputQueryChoices = (prompt: string, locale: string): string[] =>
    [
        ...new Set([
            ...[...prompt.matchAll(/「([^」]+)」|“([^”]+)”|"([^"]+)"/gu)].map(
                (match) => match[1] || match[2] || match[3] || '',
            ),
            ...[...new Intl.Segmenter(locale, { granularity: 'word' }).segment(prompt)]
                .filter((part) => part.isWordLike)
                .map((part) => part.segment),
        ]),
    ]
        .filter((value) => value.length <= 100)
        .slice(0, 40)

export function selectedDate(
    parts: (string | undefined)[],
    timeZone: string,
    currentTime: number,
    future: boolean,
) {
    if (parts.some((part) => !part || part === 'unchanged')) return ''
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
    multiple?: (
        count: string,
        routing: {
            state: Record<string, unknown>
            questions: Record<string, Experimental_ChoiceQuestion>
        },
    ) => Promise<ComposerBatch>,
): AsyncGenerator<ComposerEvent> {
    signal.throwIfAborted()
    const models = admin.models
    const existing =
        input.model && input.entryId ? await admin.get(input.model, input.entryId) : undefined
    const scalarData = (entry: Entry) =>
        Object.fromEntries(
            Object.entries(entry.data).flatMap(([key, value]) =>
                typeof value === 'string' && value.length <= 200
                    ? [[key, value]]
                    : Array.isArray(value) && value.every((part) => typeof part === 'string')
                      ? [
                            [
                                key,
                                value
                                    .slice(0, 20)
                                    .filter((part) => part.length <= 100)
                                    .join(', '),
                            ],
                        ]
                      : [],
            ),
        )
    const queryChoices = inputQueryChoices(input.prompt, input.locale)
    const initialChoices = inputChoices(input.prompt, input.locale)
    const choices = [
        ...new Set([...initialChoices, ...Object.values(existing ? scalarData(existing) : {})]),
    ]
    const fields = [
        ...new Map(
            models.flatMap((model) => model.fields).map((field) => [field.key, field]),
        ).values(),
    ]
    const zonedNow = new Intl.DateTimeFormat('sv-SE', {
        timeZone: input.timeZone,
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(currentTime)
    const fieldQuestions = (candidates: string[], available: ComposerField[]) =>
        Object.fromEntries(
            available
                .filter((field) => field.kind !== 'datetime' && field.key !== 'slug')
                .map((field) => {
                    const icons = candidates
                        .filter((value) => /^[a-z][a-z0-9-]*$/i.test(value))
                        .map(
                            (value) =>
                                'simple-icons:' + value.toLowerCase().replace(/[^a-z0-9]/g, ''),
                        )
                    const values = ['image', 'images', 'file'].includes(field.kind)
                        ? []
                        : (field.values ??
                          (field.key === 'icon'
                              ? [
                                    ...candidates.filter((value) =>
                                        /^(simple-icons|mingcute):[a-z0-9-]+$/.test(value),
                                    ),
                                    ...icons,
                                ]
                              : field.kind === 'url'
                                ? candidates.filter((value) => {
                                      try {
                                          return ['https:', 'http:'].includes(
                                              new URL(value).protocol,
                                          )
                                      } catch {
                                          return false
                                      }
                                  })
                                : candidates))
                    return [
                        'field.' + field.key,
                        question(`Choose ${field.key} according to fieldPolicy.`, {
                            hide: 'Unrelated, optional/defaulted and not requested, or unchanged: omit this field.',
                            ask: 'Necessary input whose value cannot be inferred from the supplied facts.',
                            ...(field.key === 'icon'
                                ? {
                                      empty: 'No confidently recognized applicable icon; leave this value empty. For an unknown profile service choose empty, never invent a brand or substitute a generic link icon.',
                                  }
                                : {}),
                            ...options(values),
                        }),
                    ]
                }),
        )
    const routingQuestions: Record<string, Experimental_ChoiceQuestion> = {
        model: question(
            'Choose by the subject and intended use of this record. Distinguish a service profile from a tool skill, and a standalone artwork from a product/project achievement. Screen context is only a hint. When the subject is ambiguous choose clarify instead of guessing.',
            {
                ...Object.fromEntries(
                    models.map((model) => [model.name, composerModelDescriptions[model.name]]),
                ),
                clarify: 'No clear matching content model.',
            },
        ),
        intent: question(
            'What does the user want? A bare resource such as a URL can imply adding it. Use lookup to check for an existing identity before creating a duplicate. An entry in lookup results is not automatically an edit request.',
            {
                create: 'Create a blank entry with no identity to check, or prepare a new entry AFTER an empty complete lookup.',
                resolve:
                    'A concrete identity is supplied (URL/account/title/company/game/name), including a named entry to schedule: first look for existing entries, then prepare creation or editing.',
                edit: 'Modify an explicitly selected existing entry, or a matching entry confirmed by lookup results.',
                search: 'The user wants to find, inspect or browse existing entries.',
                manage: 'Open the existing screen for publishing, deletion, history or reordering.',
                settings: 'Open account or site settings.',
                clarify:
                    'The purpose or content type cannot be inferred. Unknown existing status is NOT a reason to clarify: resolve handles that. Date questions handle incomplete dates.',
            },
        ),
        ...Object.fromEntries(
            models.map((model) => [
                'query.' + model.name,
                question(
                    `Choose the ${model.label ?? model.name} identifier (${model.displayField ?? 'name/title/account'}) according to queryPolicy.`,
                    {
                        all: 'Browse all entries without a filter.',
                        none: 'No usable identifying value for this model.',
                        ...options(queryChoices),
                    },
                ),
            ]),
        ),
        datePurpose: question(
            'Is a date actually requested? Creating an article does NOT imply a publication schedule. Default to none. Never expose scheduling merely because it is supported.',
            {
                none: 'No publication/creation date requested. Employment periods, seasons and generic creation are not creation timestamps.',
                publication: 'The user explicitly wants to schedule publication.',
                creation: 'The user explicitly supplies or changes an entry creation date.',
            },
        ),
        formDetails: question(
            'Does this request need detailed field decisions? Consider all fields of the chosen model and fieldPolicy, including optional/defaulted fields explicitly supplied or requested.',
            {
                minimum:
                    'A blank creation needs only required nondefault inputs, or the request only searches or navigates. No supplied values or specific optional fields need resolving.',
                resolve:
                    'Resolve supplied values, requested optional fields (even without a value), or the fields to edit. URL/account/icon alternatives count as supplied values. Do not drop optional details.',
            },
        ),
    }
    if (input.model && !input.entryId) {
        for (const key of ['edit', 'search', 'manage', 'settings'])
            delete routingQuestions.intent!.criteria[key]
        routingQuestions.intent!.instructions +=
            ' The user explicitly selected this model to add data. Choose create for a blank entry or resolve to check an identifying value before adding.'
    }
    if (input.batch)
        routingQuestions.itemCount = question(
            'How many separate new records are requested? Count records, not fields, tags, search results or game ranks. For search/navigation/editing or one record choose one. Follow explicit counts and separately listed subjects. Use unclear if the quantity cannot be established; never invent extra records.',
            {
                one: 'One record or one non-creation operation.',
                ...Object.fromEntries(
                    Array.from({ length: 9 }, (_, i) => [
                        String(i + 2),
                        String(i + 2) + ' separate records to add.',
                    ]),
                ),
                unclear: 'The requested quantity is ambiguous.',
                overflow: 'More than ten new records are requested.',
            },
        )
    const state = {
        request: input.prompt,
        locale: input.locale,
        timeZone: input.timeZone,
        currentTime: zonedNow,
        context: input.context,
        selectedModel: input.model,
        selectedEntry: input.entryId,
        existing: existing ? scalarData(existing) : undefined,
        models: models.map((model) => ({
            ...model,
            fields: model.fields.map(({ required, hasDefault, ...field }) => ({
                ...field,
                needsInput: Boolean(required && !hasDefault),
                defaulted: Boolean(hasDefault),
            })),
        })),
        inputCandidates: choices,
        queryPolicy:
            'Choose a concrete supplied value identifying the entry, never a field label, model category or action word. For a URL prefer its original account/path identifier over the host or platform; use the host only without a path identifier. Choose all only for browsing, none without a usable identifier.',
        fieldPolicy: [
            'Prepare the minimum useful UI. Omit unrelated or unspecified optional/defaulted fields. Explicitly supplied optional information MUST be shown and filled.',
            'For each field, choose hide if unnecessary or unchanged; ask only for required nondefault or explicitly requested missing input; otherwise select the best supplied literal value.',
            'Prefer supported facts over asking again: quoted values, URL parts and conventional account handles/icons may fill fields.',
            'For a profile/account link, prefer the conventional @account label. Only choose a confidently recognized existing applicable brand icon; candidate slugs are possibilities, not proof that an icon exists; for unknown services an empty icon is valid and complete, do not ask for an icon or invent one. A URL field receives the complete supplied URL.',
            'Never use action words or the whole command as a title, label, name or tag.',
            'For search, settings and management navigation, hide all editable fields.',
            'Publishing, deletion, history and reordering use the full management screen (manage). Only post publication-time preparation is available in this composer.',
            'Defaulted arrays stay hidden unless the user supplies or asks for them.',
        ],
    }
    let questions = routingQuestions
    let decision = await evaluate({ state, questions, signal })
    signal.throwIfAborted()
    const answer = (key: string) => decision.answers[key]?.choice ?? 'none'
    const chosenValue = (key: string) => questions[key]?.criteria[answer(key)]
    if (input.batch && multiple && !input.entryId && answer('itemCount') !== 'one') {
        yield { type: 'batch', batch: await multiple(answer('itemCount'), { state, questions }) }
        return
    }
    let model = input.model ?? models.find((item) => item.name === answer('model'))?.name ?? null
    const initialIntent = input.entryId ? 'edit' : answer('intent')
    const purpose = answer('datePurpose') as ComposerPlan['datePurpose']
    const queries = new Map(
        models.map((item) => {
            const key = 'query.' + item.name
            const choice = answer(key)
            return [
                item.name,
                choice === 'none' ? null : choice === 'all' ? '' : (chosenValue(key) ?? ''),
            ] as const
        }),
    )
    const lookupModels =
        input.entryId || !['resolve', 'search', 'edit'].includes(initialIntent)
            ? []
            : model
              ? models.filter((item) => item.name === model)
              : models
    const pages = await Promise.all(
        lookupModels.map(async (item) => ({
            model: item.name,
            ...(await admin.list(item.name, queries.get(item.name) ?? '', signal)),
        })),
    )
    signal.throwIfAborted()
    const entries = pages.flatMap((page) =>
        page.items.map((entry) => ({ ...entry, model: page.model })),
    )
    const prepares = Boolean(model && ['create', 'resolve', 'edit'].includes(initialIntent))
    const needsValues = prepares && answer('formDetails') === 'resolve'
    const needsLookupDecision = pages.length > 0 && !['search', 'manage'].includes(initialIntent)
    if (needsLookupDecision || (prepares && purpose !== 'none') || needsValues) {
        const candidates = [
            ...new Set([
                ...choices,
                ...entries.flatMap((entry) => Object.values(scalarData(entry))),
            ]),
        ].slice(0, 40)
        questions = {
            ...(!model ? { model: routingQuestions.model! } : {}),
            intent: {
                ...routingQuestions.intent!,
                criteria: { ...routingQuestions.intent!.criteria },
            },
            ...(purpose !== 'none' ? { datePurpose: routingQuestions.datePurpose! } : {}),
            ...fieldQuestions(
                candidates,
                model ? models.find((item) => item.name === model)!.fields : fields,
            ),
        }
        if (entries.length)
            questions.intent!.criteria.edit =
                'An existing entry matches the supplied identity. Select it for user confirmation instead of creating a duplicate.'
        delete questions.intent!.criteria.resolve
        if (!entries.length && !input.entryId) delete questions.intent!.criteria.edit
        if (pages.length)
            questions.entry = question(
                'Choose the existing entry matching the requested identity. Choose none only when no matching entry exists; select choose when ambiguous. An empty complete lookup permits new creation. Preserve an explicit search request as search even if one result exists.',
                {
                    none: 'No matching entry; a new entry may be prepared.',
                    choose: 'Several entries or incomplete results need user selection.',
                    ...Object.fromEntries(
                        entries.map((entry) => [
                            entry.id,
                            JSON.stringify({ model: entry.model, ...scalarData(entry) }),
                        ]),
                    ),
                },
            )
        if (purpose !== 'none') {
            const year = Number(zonedNow.slice(0, 4))
            const years = [
                ...new Set([
                    ...Array.from({ length: 21 }, (_, i) => String(year - 10 + i)),
                    ...initialChoices.filter((value) => /^\d{4}$/.test(value)),
                ]),
            ]
            for (const [part, range] of Object.entries({
                year: years,
                month: 12,
                day: 31,
                hour: 24,
                minute: 60,
            })) {
                const values = Array.isArray(range)
                    ? range
                    : Array.from({ length: range }, (_, i) =>
                          String(i + (part === 'month' || part === 'day' ? 1 : 0)),
                      )
                questions['date.' + part] = question(
                    `Resolve the requested ${part} relative to currentTime in timeZone. Use unchanged if missing or ambiguous. Choose the clock time requested by the user, never copy the current clock as a default. For example, 18時 means hour 18 and minute 0. Use the current date only to resolve relative dates.`,
                    {
                        unchanged: 'Missing or ambiguous.',
                        ...Object.fromEntries(values.map((value) => [value, value])),
                    },
                )
            }
        } else delete questions.datePurpose
        decision = await evaluate({
            state: {
                ...state,
                selectedModel: model,
                initialIntent,
                models: state.models.filter((item) => !model || item.name === model),
                lookup: pages.map((page) => ({
                    model: page.model,
                    total: page.total,
                    complete: page.items.length >= page.total,
                    entries: page.items.map((entry) => ({ id: entry.id, data: scalarData(entry) })),
                })),
            },
            questions,
            signal,
        })
        signal.throwIfAborted()
        model =
            input.model ??
            (questions.model
                ? (models.find((item) => item.name === answer('model'))?.name ?? null)
                : model)
    }
    const match = entries.find((entry) => entry.id === answer('entry'))
    let intent = (input.entryId ? 'edit' : answer('intent')) as ComposerPlan['intent']
    if ((intent as string) === 'resolve') intent = 'clarify'
    let entryId = input.entryId
    if (intent === 'edit' && !entryId) {
        if (match) {
            model = match.model
            entryId = match.id
        } else intent = 'search'
    }
    if (intent === 'create' && pages.some((page) => page.total > page.items.length) && !match)
        intent = 'search'
    if (answer('entry') === 'choose') intent = 'search'
    if (!model && !['settings', 'search'].includes(intent)) intent = 'clarify'
    const info = models.find((item) => item.name === model)
    const plan: ComposerPlan = {
        model,
        intent,
        entryId,
        fields: info?.fields ?? [],
        visibleFields: [],
        values: {},
        datePurpose:
            purpose === 'none' ? 'none' : (answer('datePurpose') as ComposerPlan['datePurpose']),
        publishAt: '',
        timeZone: input.timeZone,
        dateIncomplete: false,
        query: model ? (queries.get(model) ?? '') : '',
        results: entries.map((entry) => ({
            id: entry.id,
            model: entry.model,
            title: String(
                entry.data.title ??
                    entry.data.name ??
                    entry.data.company ??
                    entry.data.game ??
                    entry.data.label ??
                    entry.id,
            ),
        })),
        total: pages.reduce((sum, page) => sum + page.total, 0),
    }
    if (plan.intent === 'create' || plan.intent === 'edit') {
        for (const field of plan.fields) {
            const key = 'field.' + field.key
            const choice = answer(key)
            if (
                (choice !== 'hide' && questions[key]) ||
                (field.required && !field.hasDefault && plan.intent === 'create')
            )
                plan.visibleFields.push(field.key)
            if (!questions[key] || ['hide', 'ask', 'none'].includes(choice)) continue
            const value = field.key === 'icon' && choice === 'empty' ? '' : chosenValue(key)!
            if (field.kind === 'url') {
                try {
                    if (!['https:', 'http:'].includes(new URL(value).protocol)) continue
                } catch {
                    continue
                }
            }
            plan.values[field.key] =
                field.kind === 'array'
                    ? value
                          .split(/[,、\n]/u)
                          .map((part) => part.trim())
                          .filter(Boolean)
                    : value
        }
        if (plan.datePurpose !== 'none') {
            const date = selectedDate(
                ['year', 'month', 'day', 'hour', 'minute'].map((part) => {
                    const key = 'date.' + part
                    return answer(key) === 'unchanged' ? 'unchanged' : chosenValue(key)
                }),
                input.timeZone,
                currentTime,
                plan.datePurpose === 'publication',
            )
            if (plan.datePurpose === 'publication' && info?.scheduling && model === 'posts') {
                plan.publishAt = date
                plan.dateIncomplete = !date
            } else if (
                plan.datePurpose === 'creation' &&
                plan.fields.some((field) => field.key === 'createdAt')
            ) {
                plan.visibleFields.push('createdAt')
                plan.dateIncomplete = !date
                if (date)
                    plan.values.createdAt = toZoned(
                        parseDateTime(date),
                        input.timeZone,
                        'reject',
                    ).toAbsoluteString()
            } else plan.datePurpose = 'none'
        }
    } else plan.datePurpose = 'none'
    signal.throwIfAborted()
    yield { type: 'plan', plan }
    yield { type: 'complete', spec: defaultComposerSpec(plan), fallback: false }
}

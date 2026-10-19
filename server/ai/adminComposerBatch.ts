import type {
    Experimental_CompositionEvaluator,
    Experimental_ChoiceQuestion,
} from '@json-render/core'

import {
    type ComposerBatch,
    type ComposerEvent,
    type ComposerItem,
    type ComposerItemInput,
    type ComposerPlan,
    type ComposerRequest,
} from '../../shared/utils/adminComposer'
import {
    composeAdmin,
    inputQueryChoices,
    options,
    question,
    type ComposerAdmin,
} from './adminComposer'

type Evaluation = Parameters<Experimental_CompositionEvaluator>[0]
type Decision = Awaited<ReturnType<Experimental_CompositionEvaluator>>
type Routing = {
    state: Record<string, unknown>
    questions: Record<string, Experimental_ChoiceQuestion>
}

async function parallel<T, R>(
    values: T[],
    task: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
    const result: R[] = []
    let next = 0
    await Promise.all(
        Array.from({ length: Math.min(2, values.length) }, async () => {
            while (next < values.length) {
                const index = next++
                result[index] = await task(values[index]!, index)
            }
        }),
    )
    return result
}

export function composerSources(prompt: string) {
    const ranges = [
        ...prompt.matchAll(/[^\n、;；]+/gu),
        ...prompt.matchAll(/https?:\/\/[^\s<>"「」]+/gu),
        ...prompt.matchAll(/「[^」]+」|“[^”]+”|"[^"]+"/gu),
    ].map((match) => ({ start: match.index, end: match.index + match[0].length }))
    ranges.push({ start: 0, end: prompt.length })
    return [...new Map(ranges.map((range) => [range.start + ':' + range.end, range])).values()]
}

function protectCreation(plan: ComposerPlan, selected?: string) {
    return !selected && plan.intent === 'edit'
        ? { ...plan, intent: 'search' as const, entryId: undefined, visibleFields: [], values: {} }
        : plan
}

async function resolveItem(
    input: ComposerRequest,
    item: ComposerItemInput,
    admin: ComposerAdmin,
    evaluate: Experimental_CompositionEvaluator,
    signal: AbortSignal,
    now: number,
): Promise<ComposerItem> {
    try {
        let plan: ComposerPlan | undefined
        for await (const event of composeAdmin(
            {
                prompt: input.prompt.slice(item.source.start, item.source.end),
                locale: input.locale,
                timeZone: input.timeZone,
                context: input.context,
                model: item.model,
                entryId: item.entryId,
            },
            admin,
            evaluate,
            signal,
            now,
        )) {
            if (event.type === 'plan') plan = protectCreation(event.plan, item.entryId)
        }
        if (!plan) throw new Error('No form was prepared')
        return { ...item, plan }
    } catch (error) {
        return {
            ...item,
            error:
                signal.aborted || (error instanceof Error && error.name === 'TimeoutError')
                    ? '解析がタイムアウトしました。'
                    : 'この項目を準備できませんでした。再試行してください。',
        }
    }
}

async function splitAndResolve(
    input: ComposerRequest,
    count: string,
    routing: Routing,
    admin: ComposerAdmin,
    evaluate: Experimental_CompositionEvaluator,
    signal: AbortSignal,
    now: number,
): Promise<ComposerBatch> {
    const empty = { requestId: input.requestId!, items: [] }
    const size = Number(count)
    if (!Number.isInteger(size) || size < 2 || size > 10)
        return {
            ...empty,
            notice:
                count === 'overflow'
                    ? '一度に作成できるのは10件までです。入力を分けてください。'
                    : '何件作成するか、または作成する項目を入力してください。',
        }
    const sources = composerSources(input.prompt)
    const queryValues = [
        ...new Set(
            sources.flatMap((source) =>
                inputQueryChoices(input.prompt.slice(source.start, source.end), input.locale),
            ),
        ),
    ]
    if (sources.length > 255 || queryValues.length > 253)
        return { ...empty, notice: '入力が複雑すぎるため、いくつかの依頼に分けてください。' }
    const questions: Record<string, Experimental_ChoiceQuestion> = {}
    for (let index = 0; index < size; index++) {
        const fields: Record<string, Experimental_ChoiceQuestion> = {
            source: question(
                'Select the smallest COMPLETE original range for this record, including its requested details. Use the whole request only if the record cannot be isolated. Identical ranges are valid for explicitly requested blank copies.',
                Object.fromEntries(
                    sources.map((source, i) => [
                        's' + i,
                        input.prompt.slice(source.start, source.end),
                    ]),
                ),
            ),
            model: routing.questions.model!,
            intent: question(
                routing.questions.intent!.instructions,
                Object.fromEntries(
                    Object.entries(routing.questions.intent!.criteria).filter(([key]) =>
                        ['create', 'resolve', 'clarify'].includes(key),
                    ),
                ),
            ),
            query: question(
                "Choose this record's identifying VALUE following queryPolicy. Do not borrow another record's name or URL. Choose none for a blank creation.",
                { none: 'No identifying value.', ...options(queryValues) },
            ),
            datePurpose: routing.questions.datePurpose!,
            formDetails: routing.questions.formDetails!,
        }
        if (sources.length === 1) delete fields.source
        if (!queryValues.length) delete fields.query
        for (const [key, value] of Object.entries(fields))
            questions['i' + index + '.' + key] = {
                ...value,
                instructions: `For record ${index + 1} of ${size} in input order: ${value.instructions}`,
            }
    }
    const split = await evaluate({
        state: { ...routing.state, sources, itemCount: size },
        questions,
        signal,
    })
    const answer = (index: number, key: string) =>
        key === 'source' && sources.length === 1
            ? 's0'
            : (split.answers['i' + index + '.' + key]?.choice ?? (key === 'query' ? 'none' : ''))
    const items = Array.from({ length: size }, (_, index): ComposerItemInput => {
        const source = sources[Number(answer(index, 'source').slice(1))]
        if (!source) throw new Error('Invalid source')
        return { id: input.requestId + '.' + index, source, model: input.model }
    })
    type Pending = {
        index: number
        request: Evaluation
        resolve: (decision: Decision) => void
        reject: (error: unknown) => void
    }
    const pending: Pending[] = []
    let finished = 0,
        flushing = false
    async function flush() {
        if (flushing || pending.length + finished !== size || !pending.length) return
        flushing = true
        const chunks: Pending[][] = []
        for (const item of pending) {
            const previous = chunks.at(-1)
            if (
                !previous ||
                previous.reduce(
                    (total, entry) => total + Object.keys(entry.request.questions).length,
                    0,
                ) +
                    Object.keys(item.request.questions).length >
                    64
            )
                chunks.push([item])
            else previous.push(item)
        }
        await parallel(chunks, async (chunk) => {
            try {
                signal.throwIfAborted()
                const joined: Record<string, Experimental_ChoiceQuestion> = {}
                const states: Record<string, unknown> = {}
                for (const item of chunk) {
                    states['i' + item.index] = item.request.state
                    for (const [key, value] of Object.entries(item.request.questions))
                        joined['i' + item.index + '.' + key] = {
                            ...value,
                            instructions: `Use ONLY state.items.i${item.index} for record ${item.index + 1}; apply its fieldPolicy. ${value.instructions}`,
                        }
                }
                const decision = await evaluate({
                    state: { originalRequest: input.prompt, items: states },
                    questions: joined,
                    signal,
                })
                for (const item of chunk)
                    item.resolve({
                        answers: Object.fromEntries(
                            Object.keys(item.request.questions).map((key) => [
                                key,
                                decision.answers['i' + item.index + '.' + key]!,
                            ]),
                        ),
                    })
            } catch (error) {
                for (const item of chunk) item.reject(error)
            }
        })
    }
    const resolved = await Promise.all(
        items.map(async (item, index) => {
            let first = true
            const itemEvaluate: Experimental_CompositionEvaluator = async (request) => {
                if (!first)
                    return new Promise<Decision>((resolve, reject) => {
                        pending.push({ index, request, resolve, reject })
                        void flush()
                    })
                first = false
                const supplied: Record<string, string> = {
                    model: input.model ?? answer(index, 'model'),
                    intent: answer(index, 'intent'),
                    datePurpose: answer(index, 'datePurpose'),
                    formDetails: answer(index, 'formDetails'),
                }
                const query = questions['i' + index + '.query']?.criteria[answer(index, 'query')]
                for (const model of admin.models) {
                    const key = 'query.' + model.name
                    supplied[key] =
                        model.name === supplied.model && answer(index, 'query') !== 'none'
                            ? (Object.entries(request.questions[key]!.criteria).find(
                                  ([, value]) => value === query,
                              )?.[0] ?? 'none')
                            : 'none'
                }
                return {
                    answers: Object.fromEntries(
                        Object.keys(request.questions).map((key) => [
                            key,
                            {
                                choice:
                                    supplied[key] ??
                                    Object.keys(request.questions[key]!.criteria)[0]!,
                            },
                        ]),
                    ),
                }
            }
            try {
                return await resolveItem(input, item, admin, itemEvaluate, signal, now)
            } finally {
                finished++
                void flush()
            }
        }),
    )
    const identities = new Set<string>()
    for (const item of resolved) {
        const href = item.plan?.model === 'socials' ? item.plan.values.href : undefined
        if (typeof href !== 'string') continue
        const identity = new URL(href).href
        if (identities.has(identity)) {
            item.plan = undefined
            item.error = '同じプロフィールURLが重複しています。入力を確認してください。'
        }
        identities.add(identity)
    }
    return { requestId: input.requestId!, items: resolved }
}

export async function* composeAdminRequest(
    input: ComposerRequest,
    admin: ComposerAdmin,
    evaluate: Experimental_CompositionEvaluator,
    signal: AbortSignal,
    now = Date.now(),
): AsyncGenerator<ComposerEvent> {
    if (input.items) {
        if (input.items.length === 1) signal = AbortSignal.any([signal, AbortSignal.timeout(5000)])
        const items = await parallel(input.items, (item) =>
            resolveItem(input, item, admin, evaluate, signal, now),
        )
        yield { type: 'batch', batch: { requestId: input.requestId!, items } }
        return
    }
    for await (const event of composeAdmin(
        input,
        admin,
        evaluate,
        AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        now,
        (count, routing) => splitAndResolve(input, count, routing, admin, evaluate, signal, now),
    )) {
        if (event.type === 'plan' && input.batch)
            yield { type: 'plan', plan: protectCreation(event.plan, input.entryId) }
        else yield event
    }
}

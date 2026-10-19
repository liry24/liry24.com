import type { Experimental_CompositionEvaluator } from '@json-render/core'
import { UsageLimit } from 'void/limits'
const evaluate: Experimental_CompositionEvaluator = async ({ questions, state }) => {
    const prompt = state.request ?? state.originalRequest
    if (prompt === 'usage-limit')
        throw new UsageLimit({
            resource: 'ai',
            reason: 'rate_limit',
            message: 'Synthetic AI limit',
        })
    if (prompt === 'upstream-error')
        throw Error('Synthetic upstream details that must stay private')
    if (prompt === 'timeout') throw new DOMException('Synthetic timeout', 'TimeoutError')
    await new Promise((resolve) => setTimeout(resolve, 20))
    const choices: Record<string, string> =
        prompt === 'lookup'
            ? { model: 'clarify', intent: 'search', itemCount: 'one' }
            : {
                  model: 'posts',
                  intent: state.selectedEntry ? 'edit' : 'create',
                  formDetails: state.selectedEntry ? 'resolve' : 'minimum',
                  itemCount: 'one',
                  'field.title': '@NewLabel',
              }
    return {
        answers: Object.fromEntries(
            Object.entries(questions).map(([key, question]) => {
                const wanted = choices[key]
                const choice =
                    wanted === undefined
                        ? Object.keys(question.criteria)[0]!
                        : Object.hasOwn(question.criteria, wanted)
                          ? wanted
                          : (Object.entries(question.criteria).find(
                                ([, value]) => value === wanted,
                            )?.[0] ?? Object.keys(question.criteria)[0]!)
                return [key, { choice }]
            }),
        ),
    }
}

export const ai = {
    run: (
        _model: string,
        request: Omit<Parameters<Experimental_CompositionEvaluator>[0], 'signal'>,
        options: { signal?: AbortSignal },
    ) => evaluate({ ...request, signal: options.signal }),
}

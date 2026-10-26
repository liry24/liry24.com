import type { Experimental_CompositionEvaluator } from '@json-render/core'
import { ai } from 'void/ai'
import { z } from 'zod'

const resultSchema = z.object({
    answers: z.record(
        z.string(),
        z.object({ choice: z.string(), confidence: z.number().optional() }),
    ),
    usage: z.object({ input_tokens: z.number().optional() }).optional(),
})
export const evaluateClef: Experimental_CompositionEvaluator = async ({
    state,
    questions,
    signal,
}) => {
    const result = resultSchema.parse(
        await ai.run(
            '@cf/cloudflare/clef-flash',
            {
                model: 'clef-flash',
                state,
                questions,
            },
            { signal },
        ),
    )
    for (const [key, question] of Object.entries(questions)) {
        const answer = result.answers[key]
        if (!answer || !Object.hasOwn(question.criteria, answer.choice))
            throw new Error('Invalid decision')
    }
    return { answers: result.answers, usage: { inputTokens: result.usage?.input_tokens } }
}

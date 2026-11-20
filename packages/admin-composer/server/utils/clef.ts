import type { Experimental_CompositionEvaluator } from '@json-render/core'
import { z } from 'zod'

const resultSchema = z.object({
    answers: z.record(
        z.string(),
        z.object({ choice: z.string(), confidence: z.number().optional() }),
    ),
    usage: z.object({ input_tokens: z.number().optional() }).optional(),
})
export type ComposerInference = {
    run(
        model: string,
        input: Record<string, unknown>,
        options: { signal?: AbortSignal },
    ): Promise<unknown>
}
export const evaluateClef = async (
    { state, questions, signal }: Parameters<Experimental_CompositionEvaluator>[0],
    ai: ComposerInference,
) => {
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

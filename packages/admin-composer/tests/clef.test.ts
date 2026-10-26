import { expect, test, vi } from 'vitest'
import { ai } from 'void/ai'

import { evaluateClef } from '../server/utils/clef.js'

vi.mock('void/ai', () => ({ ai: { run: vi.fn() } }))
test('Void inference uses Clef-flash, passes cancellation and rejects missing or unoffered choices', async () => {
    const signal = new AbortController().signal
    const request = {
        state: { input: 'test' },
        questions: {
            task: {
                type: 'choice' as const,
                instructions: 'Choose',
                criteria: { create: 'Create', search: 'Search' },
            },
        },
        signal,
    }
    vi.mocked(ai.run).mockResolvedValueOnce({
        answers: { task: { choice: 'create' } },
        usage: { input_tokens: 12 },
    })
    expect(await evaluateClef(request)).toMatchObject({
        answers: { task: { choice: 'create' } },
        usage: { inputTokens: 12 },
    })
    expect(ai.run).toHaveBeenCalledWith(
        '@cf/cloudflare/clef-flash',
        { model: 'clef-flash', state: request.state, questions: request.questions },
        { signal },
    )
    for (const answers of [{}, { task: { choice: 'delete' } }]) {
        vi.mocked(ai.run).mockResolvedValueOnce({ answers })
        await expect(evaluateClef(request)).rejects.toThrow('Invalid decision')
    }
})

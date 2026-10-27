import { MockLanguageModelV4 } from 'ai/test'

export const editorialModel = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
        const text = JSON.stringify(prompt)
        if (text.includes('UPSTREAM_ERROR')) throw new Error('PRIVATE_EDITORIAL_PROVIDER_ERROR')
        const body = text.includes('PROTECTED_CHANGE')
            ? 'This is an article. `two()` <game:game-1>'
            : 'This is an article. `one()` <game:game-1>'
        return {
            content: [
                {
                    type: 'text',
                    text: text.includes('INVALID_OUTPUT')
                        ? '{"body":42}'
                        : JSON.stringify({ body }),
                },
            ],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
            warnings: [],
        }
    },
})
export const postEditorialModel = () => editorialModel

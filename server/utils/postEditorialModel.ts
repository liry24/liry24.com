import { createOpenAI } from '@ai-sdk/openai'

// Resolve credentials only for an explicit Agent invocation.
export function postEditorialModel() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Post editorial inference is not configured.')
    return createOpenAI({
        apiKey,
        ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    }).responses('gpt-6-luna')
}

import { createOpenAI } from '@ai-sdk/openai'
import { proofreadingAgent, slugAgent } from '@litijs/blog/agents'
import { runAgent } from 'vite-hub/agent'

import { validatePostProofreading } from '../../server/utils/postEditorial'

// Explicit synthetic credentials and fetch; no provider or gateway is contacted.
export function mockPostActions(fetch: typeof globalThis.fetch) {
    const model = createOpenAI({ apiKey: 'synthetic-test-only', fetch }).responses('gpt-6-luna')
    return {
        async publication(input: { title: string; body: string }) {
            const [error, proposal] = await runAgent(slugAgent({ model }), { data: input })
            if (error || !proposal) throw error ?? new Error('Missing slug proposal')
            return proposal
        },
        async proofread(input: { body: string }) {
            const [error, proposal] = await runAgent(proofreadingAgent({ model }), { data: input })
            if (error || !proposal) throw error ?? new Error('Missing proofreading proposal')
            return await validatePostProofreading(input.body, proposal.body)
        },
    }
}

export const postActionResponse = (output: Record<string, string>) =>
    Response.json({
        id: 'synthetic-response',
        object: 'response',
        created_at: 0,
        status: 'completed',
        model: 'gpt-6-luna',
        output: [
            {
                type: 'message',
                id: 'synthetic-message',
                status: 'completed',
                role: 'assistant',
                content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }],
            },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    })

export async function postActionRequest(input: Parameters<typeof fetch>[0], init?: RequestInit) {
    const request = new Request(input, init)
    return {
        url: request.url,
        body: (await request.json()) as {
            model: string
            input: unknown[]
            text: { format: { type: string; schema: { properties: Record<string, unknown> } } }
        },
    }
}

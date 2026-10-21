import { createOpenAI } from '@ai-sdk/openai'
import { ai } from '@litijs/ai'
import { aiSdk } from '@litijs/ai/ai-sdk'
import { executeAction } from 'liti/server'

import { postAiActions } from '../../server/utils/posts'

// Always use an explicit synthetic key and a supplied fetch. These tests never
// read credentials or contact OpenAI, Workers AI, or an AI Gateway.
export function mockPostActions(fetch: typeof globalThis.fetch) {
    const model = createOpenAI({ apiKey: 'synthetic-test-only', fetch })('gpt-6-luna')
    const plugin = ai({ provider: aiSdk({ text: model }), actions: postAiActions })
    const execute = async (name: keyof typeof postAiActions, input: Record<string, unknown>) =>
        (
            await executeAction(plugin, name, input as never, {
                actor: { id: 'synthetic-action-admin', roles: ['admin'] },
            })
        ).data
    return {
        async publication(props: { title: string; content: string }) {
            return (await execute('publication', {
                title: props.title,
                context: props.content,
            })) as { slug: string }
        },
        async proofread(props: { content: string }) {
            return (await execute('proofread', props)) as { content: string }
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

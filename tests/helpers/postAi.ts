import { resolveLitiConfig } from 'liti'
import { executeAction } from 'liti/server'
import { vi } from 'vitest'

import config from '../../liti.config'

const boundary = vi.hoisted(() => ({ fetch: undefined as typeof globalThis.fetch | undefined }))
vi.mock('@ai-sdk/openai', async (original) => {
    const actual = await original<typeof import('@ai-sdk/openai')>()
    return {
        ...actual,
        openai: actual.createOpenAI({
            apiKey: 'synthetic-test-only',
            fetch: (input, init) => {
                if (!boundary.fetch) throw new Error('A synthetic provider response is required')
                return boundary.fetch(input, init)
            },
        }),
    }
})

// Execute the application's actual actions; every provider request stays in the fixture.
export function mockPostActions(fetch: typeof globalThis.fetch) {
    boundary.fetch = fetch
    const configured = resolveLitiConfig(config, [])
    const execute = async (name: 'publication' | 'proofread', input: Record<string, unknown>) =>
        (
            await executeAction(configured, name, input as never, {
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

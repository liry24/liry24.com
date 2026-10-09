import { createOpenAI } from '@ai-sdk/openai'
import { executeSiteAdminAiAction } from '@liria24/site-admin/ai'
import type { SiteAdminActor } from '@liria24/site-admin/server'

import type { PostSlugProps, PostSlugResult } from '../../server/utils/postEditorial'
import config from '../../site-admin.config'

// Always use an explicit synthetic key and a supplied fetch. These tests never
// read credentials or contact OpenAI, Workers AI, or an AI Gateway.
export function mockPostActions(fetch: typeof globalThis.fetch) {
    const model = createOpenAI({ apiKey: 'synthetic-test-only', fetch })('gpt-6-luna')
    const execute = (
        name: string,
        props: Record<string, unknown>,
        {
            actor = { id: 'synthetic-action-admin', roles: ['admin'] },
            signal,
        }: {
            actor?: SiteAdminActor | null
            signal?: AbortSignal
        } = {},
    ) =>
        executeSiteAdminAiAction(
            { ...config, ai: { ...config.ai, model } },
            name,
            { props },
            { actor, request: new Request('http://synthetic.invalid/ai', { signal }) },
        )
    return {
        execute,
        async publication(props: PostSlugProps) {
            return (await execute('publication', props)) as PostSlugResult
        },
        async proofread(props: { content: string }) {
            return (await execute('proofread', props)) as { content: string }
        },
    }
}

export const postActionResponse = (output: Record<string, string>, incomplete = false) =>
    Response.json({
        id: 'synthetic-response',
        object: 'response',
        created_at: 0,
        status: incomplete ? 'incomplete' : 'completed',
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
        ...(incomplete ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
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

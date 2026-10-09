import { createSiteAdminAI } from '@liria24/site-admin/ai'
import { afterEach, expect, test, vi } from 'vitest'
import type { createWorkersAI } from 'workers-ai-provider'

import { getWorkersAIModel, postAIModel } from '../server/utils/workersAI'
import config from '../site-admin.config'

const draft = { title: '日本語投稿', content: 'これは原稿です。', tags: [] }
type Binding = Parameters<typeof createWorkersAI>[0]['binding']
type ChatBody = {
    model?: string
    messages: unknown[]
    response_format: {
        type: string
        json_schema: { schema: { properties: Record<string, unknown> } }
    }
}
type RunOptions = {
    returnRawResponse?: boolean
    gateway?: { id: string }
    extraHeaders?: unknown
}
const gateway = vi.fn(() => {
    throw new Error('Unexpected gateway transport or experimental resume')
})
const context = (run: ReturnType<typeof vi.fn>) => ({
    platformContext: { cloudflare: { env: { AI: { run, gateway } as unknown as Binding } } },
})
const runtime = (run: ReturnType<typeof vi.fn>) =>
    createSiteAdminAI(getWorkersAIModel, context(run))
// Mock the binding's raw OpenAI Chat Completions response. The official adapter
// parses it; application code does not translate JSON, finish reasons or usage.
const proposal = (data: Record<string, string>) =>
    Response.json(
        {
            id: 'mock-completion',
            object: 'chat.completion',
            created: 0,
            model: 'gpt-6-luna',
            choices: [
                {
                    index: 0,
                    message: { role: 'assistant', content: JSON.stringify(data) },
                    finish_reason: 'stop',
                },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        { headers: { 'cf-aig-run-id': 'mock-run' } },
    )

afterEach(() => {
    vi.unstubAllGlobals()
    gateway.mockClear()
})

test('SDK v4 structured proposals use per-operation AI.run and the default Gateway contract', async () => {
    const fetch = vi.fn(() => {
        throw new Error('Unexpected external request')
    })
    vi.stubGlobal('fetch', fetch)
    const first = vi.fn(async () => proposal({ slug: 'test-post', excerpt: '記事の概要。' }))
    const second = vi.fn(async () => proposal({ content: 'これは校正した原稿です。' }))
    expect(getWorkersAIModel(context(first))).toMatchObject({
        specificationVersion: 'v4',
        modelId: 'gpt-6-luna',
    })
    const input = structuredClone(draft)
    const metadata = await runtime(first).generateMetadata('posts', config.models.posts, {
        data: input,
        generate: { slug: true, excerpt: true },
    })
    expect(metadata).toEqual({
        data: { ...draft, excerpt: '記事の概要。' },
        slug: 'test-post',
        issues: [],
    })
    const proofread = await runtime(second).proofreadDraft('posts', config.models.posts, {
        data: input,
        fields: ['content'],
    })
    expect(proofread.data).toEqual({ ...draft, content: 'これは校正した原稿です。' })
    expect(proofread.issues).toEqual([])
    expect(input).toEqual(draft)
    for (const [run, fields] of [
        [first, ['slug', 'excerpt']],
        [second, ['content']],
    ] as const) {
        expect(run).toHaveBeenCalledTimes(1)
        const [model, body, options] = run.mock.calls[0] as unknown as [
            string,
            ChatBody,
            RunOptions,
        ]
        expect(model).toBe(postAIModel)
        expect(model).toBe('openai/gpt-6-luna')
        expect(body.model).toBeUndefined()
        expect(body.messages).toEqual(expect.any(Array))
        expect(body.response_format).toMatchObject({ type: 'json_schema' })
        expect(Object.keys(body.response_format.json_schema.schema.properties).sort()).toEqual(
            [...fields].sort(),
        )
        expect(options.returnRawResponse).toBe(true)
        expect(options.gateway).toEqual({ id: 'default' })
        expect(options.extraHeaders).toBeUndefined()
    }
    expect(gateway).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
})

test('selected metadata keeps manual fields and does not mutate the submitted draft', async () => {
    const run = vi.fn(async () => proposal({ slug: 'generated-slug' }))
    const input = { ...structuredClone(draft), excerpt: '手動の概要。' }
    const original = structuredClone(input)
    const result = await runtime(run).generateMetadata('posts', config.models.posts, {
        data: input,
        generate: { slug: true, excerpt: false },
    })
    expect(result).toEqual({ data: original, slug: 'generated-slug', issues: [] })
    expect(input).toEqual(original)
    expect(run).toHaveBeenCalledTimes(1)
})

test('manual metadata bypasses AI, and unavailable AI leaves the draft intact', async () => {
    const run = vi.fn(async () => {
        throw new Error('Unavailable model')
    })
    const input = structuredClone(draft)
    const ai = runtime(run)
    expect(
        await ai.generateMetadata('posts', config.models.posts, {
            data: input,
            slug: 'manual-slug',
            generate: { slug: false, excerpt: false },
        }),
    ).toEqual({ data: draft, slug: 'manual-slug', issues: [] })
    expect(run).not.toHaveBeenCalled()
    await expect(
        ai.generateMetadata('posts', config.models.posts, {
            data: input,
            generate: { slug: true, excerpt: true },
        }),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_AI_FAILED' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(input).toEqual(draft)
    expect(() => getWorkersAIModel({ platformContext: { env: {} } })).toThrow(
        'binding is not configured',
    )
})

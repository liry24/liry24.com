import { createSiteAdminAI } from '@liria24/site-admin/ai'
import { afterEach, expect, test, vi } from 'vitest'
import type { createWorkersAI } from 'workers-ai-provider'

import { getWorkersAIModel, postAIModel } from '../server/utils/workersAI'
import config from '../site-admin.config'

const draft = { title: '試験投稿', content: 'これは原稿です。', tags: [] }
type Binding = Parameters<typeof createWorkersAI>[0]['binding']
const runtime = (run: ReturnType<typeof vi.fn>) =>
    createSiteAdminAI(getWorkersAIModel, {
        platformContext: { cloudflare: { env: { AI: { run } as unknown as Binding } } },
    })

afterEach(() => vi.unstubAllGlobals())

test('SDK structured proposals use the current Workers AI binding with no Gateway or HTTP fallback', async () => {
    const fetch = vi.fn(() => {
        throw new Error('Unexpected external request')
    })
    vi.stubGlobal('fetch', fetch)
    const first = vi.fn(async () => ({
        response: JSON.stringify({ slug: 'test-post', excerpt: '試験の概要。' }),
    }))
    const second = vi.fn(async () => ({
        response: JSON.stringify({ content: 'これは校正した原稿です。' }),
    }))
    const metadata = await runtime(first).generateMetadata('posts', config.models.posts, {
        data: draft,
        generate: { slug: true, excerpt: true },
    })
    expect(metadata).toEqual({
        data: { ...draft, excerpt: '試験の概要。' },
        slug: 'test-post',
        issues: [],
    })
    const proofread = await runtime(second).proofreadDraft('posts', config.models.posts, {
        data: draft,
        fields: ['content'],
    })
    expect(proofread.data.content).toBe('これは校正した原稿です。')
    expect(proofread.issues).toEqual([])
    expect(draft.content).toBe('これは原稿です。')
    for (const run of [first, second]) {
        expect(run).toHaveBeenCalledTimes(1)
        const [model, input, options] = run.mock.calls[0] as unknown as [
            string,
            Record<string, unknown>,
            Record<string, unknown>,
        ]
        expect(model).toBe(postAIModel)
        expect(model).toBe('openai/gpt-6-luna')
        expect(input.response_format).toMatchObject({ type: 'json_schema' })
        expect(options.gateway).toBeUndefined()
    }
    expect(fetch).not.toHaveBeenCalled()
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
    expect(input).toEqual(draft)
    expect(() => getWorkersAIModel({ platformContext: { env: {} } })).toThrow(
        'binding is not configured',
    )
})

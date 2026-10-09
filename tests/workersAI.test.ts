import { afterEach, expect, test, vi } from 'vitest'
import type { createWorkersAI } from 'workers-ai-provider'

import { generateText } from '#ai'

import {
    generatePostMetadata,
    preparePostPublication,
    postPublicationAction,
    proofreadPost,
    type PostAIExecution,
} from '../server/utils/postEditorial'
import { getWorkersAIModel, postAIModel } from '../server/utils/workersAI'

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
const runtime =
    (run: ReturnType<typeof vi.fn>): PostAIExecution =>
    (options) =>
        generateText({ ...options, model: getWorkersAIModel(context(run)) })
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
    const metadata = await generatePostMetadata(runtime(first), {
        data: input,
        generate: { slug: true, excerpt: true },
    })
    expect(metadata).toEqual({
        data: { ...draft, excerpt: '記事の概要。' },
        slug: 'test-post',
        issues: [],
    })
    const proofread = await proofreadPost(runtime(second), input)
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
    const result = await generatePostMetadata(runtime(run), {
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
        await generatePostMetadata(ai, {
            data: input,
            slug: 'manual-slug',
            generate: { slug: false, excerpt: false },
        }),
    ).toEqual({ data: draft, slug: 'manual-slug', issues: [] })
    expect(run).not.toHaveBeenCalled()
    await expect(
        generatePostMetadata(ai, {
            data: input,
            generate: { slug: true, excerpt: true },
        }),
    ).rejects.toThrow('Unavailable model')
    expect(run).toHaveBeenCalledTimes(1)
    expect(input).toEqual(draft)
    expect(() => getWorkersAIModel({ platformContext: { env: {} } })).toThrow(
        'binding is not configured',
    )
})

test('proofreading rejects changes to code, links, and assets without changing the draft', async () => {
    const input = {
        ...draft,
        content: 'Example `one()`\n\n[link](/posts/a)\n\n![image](site-admin:asset-one)',
    }
    const original = structuredClone(input)
    for (const content of [
        input.content.replace('one()', 'two()'),
        input.content.replace('/posts/a', '/posts/b'),
        input.content.replace('asset-one', 'asset-two'),
    ]) {
        const run = vi.fn(async () => proposal({ content }))
        await expect(proofreadPost(runtime(run), input)).rejects.toMatchObject({
            code: 'SITE_ADMIN_AI_OUTPUT_INVALID',
        })
        expect(input).toEqual(original)
        expect(run).toHaveBeenCalledTimes(1)
    }
})

test('editorial output contains exactly the requested fields and a valid slug', async () => {
    for (const output of [
        { slug: 'bad/slug' },
        { slug: 'valid-slug', content: 'Unexpected rewrite' },
        { slug: '' },
    ]) {
        const run = vi.fn(async () => proposal(output))
        await expect(
            generatePostMetadata(runtime(run), {
                data: draft,
                generate: { slug: true, excerpt: false },
            }),
        ).rejects.toThrow()
        expect(run).toHaveBeenCalledTimes(1)
    }
})

test.each([
    ['nested link target', '[link](/posts/a(foo).png)', '[link](/posts/a(foo).jpg)'],
    ['nested image target', '![image](/assets/a(foo).png)', '![image](/assets/a(foo).jpg)'],
    ['indented code', 'Example:\n\n    one()\n    next()', 'Example:\n\n    two()\n    next()'],
    ['multiline code span', 'Example `one()\nnext()`.', 'Example `two()\nnext()`.'],
    ['code span whitespace', 'Example `one()\nnext()`.', 'Example `one() next()`.'],
    ['multiple backticks', 'Example ``one(`x`)\nnext()``.', 'Example ``two(`x`)\nnext()``.'],
    ['long fence', '````js\none()\n```\nnext()\n````', '````js\ntwo()\n```\nnext()\n````'],
    [
        'reference target',
        '[link][a]\n\n[a]: /posts/a(foo).png',
        '[link][a]\n\n[a]: /posts/a(foo).jpg',
    ],
    ['unused reference', '[unused]: /posts/a(foo).png', '[unused]: /posts/a(foo).jpg'],
])('proofreading protects %s using native Markdown parsing', async (_name, content, changed) => {
    const input = { ...draft, content }
    const original = structuredClone(input)
    const run = vi.fn(async () => proposal({ content: changed }))
    await expect(proofreadPost(runtime(run), input)).rejects.toMatchObject({
        code: 'SITE_ADMIN_AI_OUTPUT_INVALID',
    })
    expect(input).toEqual(original)
    expect(run).toHaveBeenCalledTimes(1)
})

test('proofreading can edit prose around protected Markdown without changing its source', async () => {
    const content =
        'This are an example `one()\nnext()` with [a link](/posts/a(foo).png).\n\n    one()\n\n![image](site-admin:asset-one)\n\n[unused]: /posts/a(foo).png'
    const corrected = content.replace('This are', 'This is')
    const input = { ...draft, content }
    const run = vi.fn(async () => proposal({ content: corrected }))
    const result = await proofreadPost(runtime(run), input)
    expect(result.data.content).toBe(corrected)
    expect(input.content).toBe(content)
    expect(run).toHaveBeenCalledTimes(1)
})

test('manual publication does not call AI, and automatic updates preserve a published slug', async () => {
    const ai = vi.fn(() => {
        throw new Error('AI has no balance')
    })
    const manual = {
        data: {
            ...draft,
            publication: { slug: 'manual', excerpt: 'manual' },
            excerpt: 'My own introduction.',
        },
        slug: 'my-post',
    }
    expect(
        await preparePostPublication(ai as PostAIExecution, manual, { published: false }),
    ).toEqual({
        ...manual,
        issues: [],
    })
    expect(ai).not.toHaveBeenCalled()
    const run = vi.fn(async () => proposal({ excerpt: 'New introduction in my voice.' }))
    const automatic = {
        data: { ...draft, publication: { slug: 'auto', excerpt: 'auto' } },
        slug: 'confirmed-public-url',
    }
    const result = await preparePostPublication(runtime(run), automatic, { published: true })
    expect(result.slug).toBe('confirmed-public-url')
    expect(result.data.excerpt).toBe('New introduction in my voice.')
    expect(
        Object.keys(
            (run.mock.calls[0] as unknown as [string, ChatBody])[1].response_format.json_schema
                .schema.properties,
        ),
    ).toEqual(['excerpt'])
})

test('unpublished posts preserve their confirmed URL when automatic metadata is selected', async () => {
    const run = vi.fn(async () => proposal({ excerpt: 'A short introduction.' }))
    const data = {
        ...draft,
        publication: { slug: 'auto', excerpt: 'auto', publishedSlug: 'confirmed-url' },
    }
    const result = await preparePostPublication(
        runtime(run),
        { data, slug: '' },
        { published: false },
    )
    expect(result.slug).toBe('confirmed-url')
    expect(result.data.publication).toEqual(data.publication)
    expect(
        Object.keys(
            (run.mock.calls[0] as unknown as [string, ChatBody])[1].response_format.json_schema
                .schema.properties,
        ),
    ).toEqual(['excerpt'])
})

test('app action uses the unsaved snapshot and selected fields while preserving manual values', async () => {
    const run = vi.fn(async () => proposal({ slug: 'unsaved-title' }))
    const entry = {
        id: 'synthetic',
        model: 'posts',
        locale: '',
        translationGroup: 'synthetic',
        currentRevisionId: 'stored-base',
        revisionId: 'stored-base',
        publishedRevisionId: null,
        publishedAt: null,
        scheduledRevisionId: null,
        scheduledAt: null,
        createdAt: '2026-10-09T00:00:00Z',
        updatedAt: '2026-10-09T00:00:00Z',
        version: 1,
        sortOrder: null,
        slug: '',
        data: {
            ...draft,
            title: 'Unsaved title',
            publication: { slug: 'auto', excerpt: 'manual' },
            excerpt: 'My own introduction.',
        },
    }
    const snapshot = structuredClone(entry)
    const result = await postPublicationAction({
        entry,
        input: { generateSlug: true, generateExcerpt: true },
        ai: runtime(run),
    })
    expect(result.slug).toBe('unsaved-title')
    expect(result.data.excerpt).toBe('My own introduction.')
    const body = (run.mock.calls[0] as unknown as [string, ChatBody])[1]
    expect(JSON.stringify(body.messages)).toContain('Unsaved title')
    expect(Object.keys(body.response_format.json_schema.schema.properties)).toEqual(['slug'])
    expect(entry).toEqual(snapshot)
})

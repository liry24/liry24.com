import { afterEach, expect, test, vi } from 'vitest'

import { mockPostActions, postActionRequest, postActionResponse } from './helpers/postAi'

const draft = { title: '日本語投稿', content: 'これは原稿です。', tags: [] }
const metadataProps = {
    title: draft.title,
    content: draft.content,
}

afterEach(() => vi.unstubAllGlobals())

test('native Output generates only a slug through the unchanged provider and preserves input', async () => {
    const external = vi.fn(() => {
        throw new Error('Unexpected external request')
    })
    vi.stubGlobal('fetch', external)
    const requests: Awaited<ReturnType<typeof postActionRequest>>[] = []
    const fetch = vi.fn(async (input, init) => {
        requests.push(await postActionRequest(input, init))
        return postActionResponse(
            requests.length === 1
                ? { slug: 'test-post' }
                : { content: 'これは校正された原稿です。' },
        )
    })
    const actions = mockPostActions(fetch)
    const input = structuredClone(metadataProps)
    expect(await actions.publication(input)).toEqual({ slug: 'test-post' })
    expect(await actions.proofread({ content: input.content })).toEqual({
        content: 'これは校正された原稿です。',
    })
    expect(input).toEqual(metadataProps)
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [index, fields] of [['slug'], ['content']].entries()) {
        const request = requests[index]!
        expect(request.url).toBe('https://api.openai.com/v1/responses')
        expect(request.body.model).toBe('gpt-6-luna')
        expect(request.body.input).toEqual(expect.any(Array))
        expect(request.body.text.format.type).toBe('json_schema')
        expect(Object.keys(request.body.text.format.schema.properties).sort()).toEqual(
            fields.sort(),
        )
    }
    expect(external).not.toHaveBeenCalled()
})

test('slug output does not contain rewritten content or a generated introduction', async () => {
    const fetch = vi.fn(async () => postActionResponse({ slug: 'generated-slug' }))
    const input = { ...metadataProps }
    const original = structuredClone(input)
    expect(await mockPostActions(fetch).publication(input)).toEqual({ slug: 'generated-slug' })
    expect(input).toEqual(original)
    expect(fetch).toHaveBeenCalledTimes(1)
})

test('slug generation validates exact fields and shape and rejects incomplete responses', async () => {
    for (const output of [
        { slug: 'bad/slug' },
        { slug: 'valid-slug', content: 'Unexpected rewrite' },
        { slug: 'valid-slug', excerpt: 'Unexpected introduction' },
        { slug: '' },
        { slug: 'a'.repeat(81) },
    ]) {
        const fetch = vi.fn(async () => postActionResponse(output))
        await expect(mockPostActions(fetch).publication(metadataProps)).rejects.toThrow()
        expect(fetch).toHaveBeenCalledTimes(1)
    }
    const incomplete = vi.fn(async () =>
        postActionResponse({ content: 'A complete-looking answer.' }, true),
    )
    await expect(
        mockPostActions(incomplete).proofread({ content: draft.content }),
    ).rejects.toMatchObject({
        code: 'SITE_ADMIN_AI_OUTPUT_INVALID',
    })
    expect(incomplete).toHaveBeenCalledTimes(1)
})

test('provider failure is not retried and leaves the input intact', async () => {
    const fetch = vi.fn(async () =>
        Response.json(
            { error: { message: 'Synthetic unavailable model', type: 'test', code: 'synthetic' } },
            { status: 503 },
        ),
    )
    const input = structuredClone(metadataProps)
    await expect(mockPostActions(fetch).publication(input)).rejects.toMatchObject({
        code: 'SITE_ADMIN_AI_FAILED',
        message: 'AI action failed.',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(input).toEqual(metadataProps)
})

test('native actions reject anonymous, ungranted roles, unknown props, and empty input before inference', async () => {
    const fetch = vi.fn(async () => postActionResponse({ content: 'Unexpected inference.' }))
    const action = mockPostActions(fetch)
    await expect(
        action.execute('proofread', { content: 'Draft' }, { actor: null }),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_AUTH_REQUIRED' })
    await expect(
        action.execute(
            'proofread',
            { content: 'Draft' },
            { actor: { id: 'synthetic-editor', roles: ['editor'] } },
        ),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_FORBIDDEN' })
    for (const props of [{ content: 'Draft', unknown: true }, { content: ' ' }, { content: 1 }])
        await expect(action.execute('proofread', props)).rejects.toMatchObject({
            code: 'SITE_ADMIN_INVALID_INPUT',
        })
    await expect(action.execute('unknown', { content: 'Draft' })).rejects.toMatchObject({
        code: 'SITE_ADMIN_ENTRY_NOT_FOUND',
    })
    expect(fetch).not.toHaveBeenCalled()
})

test('server props and output factories use the captured source despite caller mutation', async () => {
    const requests: Awaited<ReturnType<typeof postActionRequest>>[] = []
    const fetch = vi.fn(async (input, init) => {
        requests.push(await postActionRequest(input, init))
        return postActionResponse({ content: 'This is an example `one()`.' })
    })
    const props = { content: 'This are an example `one()`.' }
    const pending = mockPostActions(fetch).proofread(props)
    props.content = 'Changed caller source `two()`.'
    expect(await pending).toEqual({ content: 'This is an example `one()`.' })
    expect(JSON.stringify(requests[0]!.body.input)).toContain('This are an example `one()`.')
    expect(props.content).toBe('Changed caller source `two()`.')
})

test('native server actions propagate already aborted and in-flight request cancellation', async () => {
    const fetch = vi.fn(
        async (_input, init) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), {
                    once: true,
                })
            }),
    )
    const action = mockPostActions(fetch)
    const stopped = new AbortController()
    stopped.abort(new Error('Synthetic pre-abort'))
    await expect(
        action.execute('proofread', { content: 'Draft' }, { signal: stopped.signal }),
    ).rejects.toThrow('Synthetic pre-abort')
    expect(fetch).not.toHaveBeenCalled()
    const controller = new AbortController()
    const pending = expect(
        action.execute('proofread', { content: 'Draft' }, { signal: controller.signal }),
    ).rejects.toThrow('Synthetic in-flight abort')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    controller.abort(new Error('Synthetic in-flight abort'))
    await pending
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
        const run = vi.fn(async () => postActionResponse({ content }))
        await expect(mockPostActions(run).proofread({ content: input.content })).rejects.toThrow()
        expect(input).toEqual(original)
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
    const run = vi.fn(async () => postActionResponse({ content: changed }))
    await expect(mockPostActions(run).proofread({ content: input.content })).rejects.toThrow()
    expect(input).toEqual(original)
    expect(run).toHaveBeenCalledTimes(1)
})

test('proofreading can edit prose around protected Markdown without changing its source', async () => {
    const content =
        'This are an example `one()\nnext()` with [a link](/posts/a(foo).png).\n\n    one()\n\n![image](site-admin:asset-one)\n\n[unused]: /posts/a(foo).png'
    const corrected = content.replace('This are', 'This is')
    const input = { ...draft, content }
    const run = vi.fn(async () => postActionResponse({ content: corrected }))
    const result = await mockPostActions(run).proofread({ content: input.content })
    expect(result.content).toBe(corrected)
    expect(input.content).toBe(content)
    expect(run).toHaveBeenCalledTimes(1)
})

test.each([
    [
        'inline HTML link',
        'Read <a href="/posts/original">link</a>.',
        'Read <a href="/posts/changed">link</a>.',
    ],
    ['HTML image', '<img src="/assets/original.png">', '<img src="/assets/changed.png">'],
    [
        'inline HTML image',
        'See <img src="/assets/original.png"> here.',
        'See <img src="/assets/changed.png"> here.',
    ],
    [
        'multiline HTML link',
        'Read <a\n href="/posts/original">link</a>.',
        'Read <a\n href="/posts/changed">link</a>.',
    ],
    [
        'HTML block destination',
        '<div>\n<a href="/posts/original">link</a>\n</div>',
        '<div>\n<a href="/posts/changed">link</a>\n</div>',
    ],
    [
        'other HTML attributes',
        'Read <a href="/posts/original" title="Original">link</a>.',
        'Read <a href="/posts/original" title="Changed">link</a>.',
    ],
    [
        'HTML block prose',
        '<div>\nThis are an example.\n</div>',
        '<div>\nThis is an example.\n</div>',
    ],
])('proofreading conservatively preserves %s', async (_name, content, changed) => {
    const input = { ...draft, content }
    const original = structuredClone(input)
    const run = vi.fn(async () => postActionResponse({ content: changed }))
    await expect(mockPostActions(run).proofread({ content: input.content })).rejects.toThrow()
    expect(input).toEqual(original)
    expect(run).toHaveBeenCalledTimes(1)
})

test('proofreading can edit surrounding prose while preserving raw HTML tokens', async () => {
    const content =
        'This are <a href="/posts/original">a link</a> and <img src="/assets/original.png">.\n\n<div>\nThis block stays exact.\n</div>'
    const corrected = content.replace('This are', 'These are')
    const input = { ...draft, content }
    const run = vi.fn(async () => postActionResponse({ content: corrected }))
    const result = await mockPostActions(run).proofread({ content: input.content })
    expect(result.content).toBe(corrected)
    expect(input.content).toBe(content)
    expect(run).toHaveBeenCalledTimes(1)
})

test('proofreading retains an explicit summary boundary and its blank lines', async () => {
    const content =
        'This are an introduction with [a link](/posts/example).\n\n<!-- more -->\n\nThe rest has `one()`.\n\nA final paragraph.'
    const corrected = content.replace('This are', 'This is')
    const run = vi.fn(async () => postActionResponse({ content: corrected }))
    expect(await mockPostActions(run).proofread({ content })).toEqual({ content: corrected })
    for (const changed of [
        corrected.replace('<!-- more -->', ''),
        corrected.replace('<!-- more -->', '<!-- other -->'),
        corrected.replace('\n\n<!-- more -->\n\n', '\n<!-- more -->\n'),
        corrected
            .replace('\n\n<!-- more -->', '')
            .replace('\n\nA final', '\n\n<!-- more -->\n\nA final'),
    ]) {
        const invalid = vi.fn(async () => postActionResponse({ content: changed }))
        await expect(mockPostActions(invalid).proofread({ content })).rejects.toThrow()
        expect(invalid).toHaveBeenCalledTimes(1)
    }
})

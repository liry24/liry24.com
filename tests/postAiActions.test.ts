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

test('configured proofreading preserves game mentions while editing surrounding prose', async () => {
    const content = 'This are <game:valorant> and <game:valorant>.'
    const corrected = content.replace('This are', 'These are')
    expect(
        await mockPostActions(async () => postActionResponse({ content: corrected })).proofread({
            content,
        }),
    ).toEqual({ content: corrected })
    for (const changed of [
        corrected.replace('<game:valorant>', '<game:other>'),
        corrected.replace(' and <game:valorant>', ''),
    ])
        await expect(
            mockPostActions(async () => postActionResponse({ content: changed })).proofread({
                content,
            }),
        ).rejects.toThrow()
})

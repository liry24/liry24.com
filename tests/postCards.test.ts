import { parseMarkdown } from 'comark/parse'
import { expect, test } from 'vitest'

import type { PostItem } from '../shared/types/content'
import { postCards } from '../shared/utils/postCards'
import { postMarkdownSecurity } from '../shared/utils/postMarkdown'
import { assertSafe, content, literalCode } from './helpers/postMarkdown'

const entry = (body: string): PostItem => ({
    id: 'synthetic-post',
    url: '/posts/synthetic',
    publishedAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-02T00:00:00Z',
    data: {
        title: 'Title',
        plainTitle: 'Title',
        slug: 'synthetic',
        tags: [],
        gameMentions: [],
        order: 0,
    },
    body,
})

test('post cards use the first paragraph if there is no summary delimiter', async () => {
    const [card] = await postCards([entry('Introduction\n\nFull article')])
    expect(card?.excerpt.nodes).toEqual([['p', {}, 'Introduction']])
})

test('the Markdown security policy applies to the full article and the published excerpt', async () => {
    const preview = await parseMarkdown(content, { plugins: [postMarkdownSecurity] })
    const [card] = await postCards([entry(content)])
    assertSafe(preview.nodes)
    assertSafe(card?.excerpt.nodes ?? [])
    expect(preview.nodes).toContainEqual([
        'pre',
        expect.objectContaining({ language: 'html' }),
        ['code', expect.anything(), literalCode],
    ])
    const delimiter = preview.nodes.findIndex((node) => Array.isArray(node) && node[0] === null)
    expect(delimiter).toBeGreaterThan(0)
    expect(card?.excerpt.nodes).toEqual(preview.nodes.slice(0, delimiter))
})

test('explicit card summaries use the same component and HTML security policy', async () => {
    const post = entry('FULL_BODY_SENTINEL')
    post.data.summary =
        'Introduction :game-mention{slug="valorant" :as="script" onclick="bad()"} <a href="javascript:bad()">link</a>'
    const [card] = await postCards([post])
    expect(card?.excerpt.nodes).toEqual([
        [
            'p',
            {},
            'Introduction ',
            ['game-mention', { slug: 'valorant' }, 'valorant'],
            ' ',
            ['a', {}, 'link'],
        ],
    ])
})

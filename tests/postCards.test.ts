import { expect, test } from 'vitest'

import type { PostItem } from '../shared/types/content'
import { postCards } from '../shared/utils/postCards'

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

test('post cards keep a safe introduction and exclude later body content', async () => {
    for (const body of [
        'Introduction <game:valorant>\n\n<!-- more -->\n\nFULL_BODY_SENTINEL',
        'Introduction <game:valorant>\n\nFULL_BODY_SENTINEL',
    ]) {
        const [card] = await postCards([entry(body)])
        expect(JSON.stringify(card)).toContain('Introduction')
        expect(JSON.stringify(card)).not.toContain('FULL_BODY_SENTINEL')
        expect(card?.date).toBe('2020-01-01T00:00:00Z')
    }
})

test('explicit card summaries use the same component and HTML security policy', async () => {
    const post = entry('FULL_BODY_SENTINEL')
    post.data.summary =
        'Introduction :game-mention{slug="valorant" :as="script" onclick="bad()"} <a href="javascript:bad()">link</a>'
    const cards = await postCards([post])
    expect(JSON.stringify(cards)).not.toMatch(/FULL_BODY_SENTINEL|onclick|javascript:|:as/)
    expect(JSON.stringify(cards)).toContain('valorant')
})

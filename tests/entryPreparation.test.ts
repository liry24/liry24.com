import type { ModelValidationContext } from '@litijs/model'
import { expect, test, vi } from 'vitest'

import { posts, works } from '../server/models/content'

const context: ModelValidationContext = {
    action: 'save',
    id: 'stable-id',
    locale: 'ja',
    actor: { id: 'editor', role: 'admin' },
    previous: null,
}

test('article preparation is deterministic without AI, retains body and established slug', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw Error('No external requests')
    })
    try {
        const input = { data: { title: '日本語のタイトル', tags: [] }, body: '# Original body' }
        const first = await posts.prepare!(input, context)
        expect(first.body).toBe(input.body)
        expect(first.data.title).toBe(input.data.title)
        expect(first.data.slug).toBe((await posts.prepare!(input, context)).data.slug)
        expect(first.data.gameMentions).toEqual([])
        const retained = await posts.prepare!(
            { data: { title: 'Changed title', tags: [] } },
            {
                ...context,
                previous: { slug: 'established-url', authorUserId: 'original-author' },
                body: '# Retained body',
            },
        )
        expect(retained.data.slug).toBe('established-url')
        expect(retained.data.authorUserId).toBe('original-author')
        const manual = await posts.prepare!(
            { data: { title: 'Title', tags: [], slug: ' manual-url ' } },
            context,
        )
        expect(manual.data.slug).toBe('manual-url')
        expect(network).not.toHaveBeenCalled()
    } finally {
        network.mockRestore()
    }
})

test('portfolio preparation keeps established identities and derives new slugs', async () => {
    const first = await works.prepare!({ data: { title: 'Example work' } }, context)
    expect(first.data.slug).toBe('example-work-stable-id')
    const established = await works.prepare!(
        { data: { title: 'Renamed' } },
        { ...context, previous: { slug: 'old-url' } },
    )
    expect(established.data.slug).toBe('old-url')
})

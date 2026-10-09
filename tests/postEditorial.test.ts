import { expect, test } from 'vitest'

import { postMetadataModes, postMetadataSelection } from '../shared/utils/postEditorial'

test('saved choices remain automatic and publishing preserves a confirmed URL', () => {
    const data = {
        publication: { slug: 'auto', excerpt: 'manual' },
        excerpt: 'Keep this introduction.',
    }
    expect(postMetadataModes(data)).toEqual({ slug: 'auto', excerpt: 'manual' })
    expect(postMetadataSelection(data, false)).toEqual({ slug: true, excerpt: false })
    expect(postMetadataSelection(data, true)).toEqual({ slug: false, excerpt: false })
    expect(data.excerpt).toBe('Keep this introduction.')
})

test('legacy revisions keep unrecorded metadata until the author selects auto', () => {
    expect(postMetadataSelection({ excerpt: 'Existing introduction.' }, false)).toEqual({
        slug: false,
        excerpt: false,
    })
    expect(
        postMetadataSelection({ publication: { slug: 'manual', excerpt: 'auto' } }, true),
    ).toEqual({
        slug: false,
        excerpt: true,
    })
})

test('a confirmed URL remains reserved after unpublishing', () => {
    expect(
        postMetadataSelection(
            { publication: { slug: 'auto', excerpt: 'auto', publishedSlug: 'confirmed-url' } },
            false,
        ),
    ).toEqual({ slug: false, excerpt: true })
})

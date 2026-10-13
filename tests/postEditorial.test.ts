import { expect, test } from 'vitest'

import { postGeneratesSlug, postPublicationSettings } from '../shared/utils/postEditorial'

test('saved choices remain automatic and publishing preserves a confirmed URL', () => {
    const data = {
        publication: { slug: 'auto', excerpt: 'manual' },
        excerpt: 'Keep this introduction.',
    }
    expect(postPublicationSettings(data)).toEqual({ slug: 'auto' })
    expect(postGeneratesSlug(data, false)).toBe(true)
    expect(postGeneratesSlug(data, true)).toBe(false)
    expect(data.excerpt).toBe('Keep this introduction.')
})

test('legacy revisions keep unrecorded URLs and ignore retired excerpt choices', () => {
    expect(postGeneratesSlug({ excerpt: 'Existing introduction.' }, false)).toBe(false)
    expect(postGeneratesSlug({ publication: { slug: 'manual', excerpt: 'auto' } }, true)).toBe(
        false,
    )
})

test('a confirmed URL remains reserved after unpublishing', () => {
    expect(
        postGeneratesSlug(
            { publication: { slug: 'auto', excerpt: 'auto', publishedSlug: 'confirmed-url' } },
            false,
        ),
    ).toBe(false)
})

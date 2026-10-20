import { expect, test } from 'vitest'

import { postPublicationSettings } from '../shared/utils/postEditorial'

test('keeps automatic publication choices', () => {
    expect(postPublicationSettings({ publication: { slug: 'auto' } })).toEqual({ slug: 'auto' })
})

test('defaults missing or malformed publication settings to manual', () => {
    for (const publication of [undefined, null, [], { slug: 'invalid' }])
        expect(postPublicationSettings({ publication })).toEqual({ slug: 'manual' })
})

test('does not retain a second publication URL marker', () => {
    expect(
        postPublicationSettings({ publication: { slug: 'auto', publishedSlug: 'old' } }),
    ).toEqual({ slug: 'auto' })
})

import { expect, test } from 'vitest'

import { postPublicationSettings } from '../shared/utils/postEditorial'

test('keeps automatic publication choices', () => {
    expect(postPublicationSettings({ publication: { slug: 'auto' } })).toEqual({ slug: 'auto' })
})

test('defaults missing or malformed publication settings to manual', () => {
    for (const publication of [undefined, null, [], { slug: 'invalid' }])
        expect(postPublicationSettings({ publication })).toEqual({ slug: 'manual' })
})

test('keeps the confirmed URL marker after unpublishing', () => {
    expect(
        postPublicationSettings({ publication: { slug: 'auto', publishedSlug: 'confirmed-url' } }),
    ).toEqual({
        slug: 'auto',
        publishedSlug: 'confirmed-url',
    })
})

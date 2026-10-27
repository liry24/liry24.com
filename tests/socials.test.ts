import { expect, test } from 'vitest'

import { socialSlug } from '../shared/utils/socials'

test('social redirects preserve ordinary segments and reserve app routes', () => {
    for (const slug of ['github', 'My_Profile', '日本語']) expect(socialSlug(slug)).toBe(true)
    for (const slug of [
        '',
        '.',
        '..',
        'posts',
        'ADMIN',
        '_nuxt',
        'api',
        'nested/path',
        'a\\b',
        'a?b',
        'a#b',
        'a\nb',
    ])
        expect(socialSlug(slug)).toBe(false)
})

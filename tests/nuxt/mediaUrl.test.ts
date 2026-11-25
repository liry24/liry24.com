import { expect, test } from 'vitest'

import { useRuntimeConfig } from '#imports'

import { mediaUrl } from '../../app/utils/mediaUrl'

test('native Blob paths retain encoding and switch between app and image domain', () => {
    const config = useRuntimeConfig()
    config.public.imagesDomain = ''
    config.public.siteUrl = ''
    const image = { pathname: '作品/cover image.png' }
    expect(mediaUrl(image)).toBe('/media/%E4%BD%9C%E5%93%81/cover%20image.png')
    config.public.siteUrl = 'https://site.example'
    config.public.imagesDomain = 'https://site.example'
    expect(mediaUrl(image)).toContain('/media/')
    config.public.imagesDomain = 'https://images.example/'
    expect(mediaUrl(image)).toBe('https://images.example/%E4%BD%9C%E5%93%81/cover%20image.png')
    expect(mediaUrl(undefined)).toBeUndefined()
    expect(mediaUrl(null)).toBeUndefined()
})

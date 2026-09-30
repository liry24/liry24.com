import { expect, test } from 'bun:test'

import { adminAssetUrl } from '../app/utils/adminPresentation'

test('admin thumbnails use the authenticated asset route for IDs, references and galleries', () => {
    for (const value of ['draft-image', { id: 'draft-image' }, [{ id: 'draft-image' }]])
        expect(adminAssetUrl(value)).toBe('/api/site-admin/assets/draft-image/content')
    for (const value of [null, undefined, '', [], {}, { id: 42 }])
        expect(adminAssetUrl(value)).toBeUndefined()
    expect(adminAssetUrl('a/b')).toBe('/api/site-admin/assets/a%2Fb/content')
})

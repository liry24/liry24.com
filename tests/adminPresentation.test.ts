import { expect, test } from 'vitest'

import { adminAssetId } from '../app/utils/adminPresentation'

test('admin thumbnails accept IDs, references and galleries', () => {
    for (const value of ['draft-image', { id: 'draft-image' }, [{ id: 'draft-image' }]])
        expect(adminAssetId(value)).toBe('draft-image')
    for (const value of [null, undefined, '', [], {}, { id: 42 }])
        expect(adminAssetId(value)).toBeUndefined()
})

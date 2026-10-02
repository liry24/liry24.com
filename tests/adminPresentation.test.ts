import { expect, test } from 'bun:test'

import type { EntryRecord } from '@liria24/site-admin/server'

import { adminAssetUrl, loadAdminEntries } from '../app/utils/adminPresentation'

test('admin thumbnails use the authenticated asset route for IDs, references and galleries', () => {
    for (const value of ['draft-image', { id: 'draft-image' }, [{ id: 'draft-image' }]])
        expect(adminAssetUrl(value)).toBe('/api/site-admin/assets/draft-image/content')
    for (const value of [null, undefined, '', [], {}, { id: 42 }])
        expect(adminAssetUrl(value)).toBeUndefined()
    expect(adminAssetUrl('a/b')).toBe('/api/site-admin/assets/a%2Fb/content')
})

test('admin list loads every page before reordering, including the 101st entry', async () => {
    const entries = Array.from({ length: 201 }, (_, id) => ({ id: String(id) }) as EntryRecord)
    const offsets: number[] = []
    expect(
        await loadAdminEntries(async (offset) => {
            offsets.push(offset)
            return {
                items: entries.slice(offset, offset + 100),
                total: entries.length,
                limit: 100,
                offset,
            }
        }),
    ).toEqual(entries)
    expect(offsets).toEqual([0, 100, 200])
    await expect(
        loadAdminEntries(async (offset) => ({
            items: [],
            total: 1,
            limit: 100,
            offset,
        })),
    ).rejects.toThrow('Reload latest')
})

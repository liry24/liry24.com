import { createSiteAdminManagementClient, managementAssetUrl } from '@liria24/site-admin/client'
import type { EntryRecord } from '@liria24/site-admin/server'
import { expect, test } from 'vitest'

import { adminAssetId } from '../app/utils/adminPresentation'

test('admin thumbnails use the authenticated asset route for IDs, references and galleries', () => {
    for (const value of ['draft-image', { id: 'draft-image' }, [{ id: 'draft-image' }]])
        expect(managementAssetUrl(adminAssetId(value)!)).toBe(
            '/api/site-admin/assets/draft-image/content',
        )
    for (const value of [null, undefined, '', [], {}, { id: 42 }])
        expect(adminAssetId(value)).toBeUndefined()
    expect(managementAssetUrl(adminAssetId('a/b')!)).toBe('/api/site-admin/assets/a%2Fb/content')
})

test('admin list loads every page before reordering, including the 101st entry', async () => {
    const entries = Array.from({ length: 201 }, (_, id) => ({ id: String(id) }) as EntryRecord)
    const offsets: number[] = []
    const client = createSiteAdminManagementClient({
        fetch: async (input) => {
            const offset = Number(
                new URL(String(input), 'http://localhost').searchParams.get('offset'),
            )
            offsets.push(offset)
            return Response.json({
                items: entries.slice(offset, offset + 100),
                total: entries.length,
                limit: 100,
                offset,
            })
        },
    })
    expect(await client.listAllEntries('posts')).toEqual(entries)
    expect(offsets).toEqual([0, 100, 200])
    await expect(
        createSiteAdminManagementClient({
            fetch: async () => Response.json({ items: [], total: 1, limit: 100, offset: 0 }),
        }).listAllEntries('posts'),
    ).rejects.toThrow('Reload latest')
})

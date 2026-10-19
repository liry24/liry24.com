import { afterEach, beforeEach, expect, test, vi } from 'vitest'
beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('IGDB_CLIENT_ID', 'synthetic-client')
    vi.stubEnv('IGDB_CLIENT_SECRET', 'synthetic-secret')
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})
test('IGDB keeps exact identity, validates images and caches OAuth credentials without exposing them', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'synthetic-token', expires_in: 3600 }))
        .mockImplementation(async () =>
            Response.json([
                {
                    id: 1,
                    slug: 'exact-igdb-slug',
                    name: 'Exact Game',
                    cover: { image_id: 'co123' },
                },
            ]),
        )
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../server/utils/igdb')
    expect(await queryIgdb({ search: 'a"; where id = 2;' })).toEqual([
        {
            igdbId: 1,
            slug: 'exact-igdb-slug',
            name: 'Exact Game',
            cover: 'https://images.igdb.com/igdb/image/upload/t_cover_small/co123.jpg',
        },
    ])
    await queryIgdb({ id: 1 })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1]![1].body).toContain('search "a\\"; where id = 2;";')
    expect(fetch.mock.calls[2]![1].body).toContain('where id = 1;')
})
test('unavailable credentials, malformed results and network failures return safe errors', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'synthetic-token', expires_in: 3600 }))
        .mockResolvedValueOnce(Response.json([{ id: 1, slug: '../bad', name: 'Unsafe' }]))
        .mockRejectedValue(Error('SENSITIVE_REMOTE_DETAIL'))
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../server/utils/igdb')
    await expect(queryIgdb({ search: 'game' })).rejects.toMatchObject({
        statusCode: 502,
        message: expect.not.stringContaining('SENSITIVE_REMOTE_DETAIL'),
    })
    await expect(queryIgdb({ search: 'game' })).rejects.toMatchObject({
        statusCode: 502,
        message: expect.not.stringContaining('SENSITIVE_REMOTE_DETAIL'),
    })
    vi.stubEnv('IGDB_CLIENT_SECRET', '')
    await expect(queryIgdb({ search: 'game' })).rejects.toMatchObject({ statusCode: 503 })
})

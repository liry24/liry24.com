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
    const { queryIgdb } = await import('../../server/utils/igdb')
    expect(await queryIgdb({ search: 'a"; where id = 2;' })).toEqual([
        {
            igdbId: 1,
            slug: 'exact-igdb-slug',
            name: 'Exact Game',
            cover: 'https://images.igdb.com/igdb/image/upload/t_thumb/co123.jpg',
        },
    ])
    await queryIgdb({ id: 1 })
    await queryIgdb({ slug: 'exact-igdb-slug' })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch.mock.calls[1]![1].body).toContain(String.raw`search "a\"; where id = 2;";`)
    expect(fetch.mock.calls[1]![1]).toMatchObject({
        method: 'POST',
        headers: { 'Client-ID': 'synthetic-client', Authorization: 'Bearer synthetic-token' },
        body: expect.stringContaining('limit 10;'),
    })
    expect(fetch.mock.calls[2]![1].body).toContain('where id = 1; limit 1;')
    expect(fetch.mock.calls[3]![1].body).toContain('where slug = "exact-igdb-slug"; limit 1;')
})
test('unavailable credentials, malformed results and network failures return safe errors', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'synthetic-token', expires_in: 3600 }))
        .mockResolvedValueOnce(Response.json([{ id: 1, slug: '../bad', name: 'Unsafe' }]))
        .mockRejectedValue(Error('SENSITIVE_REMOTE_DETAIL'))
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../../server/utils/igdb')
    await expect(queryIgdb({ search: 'game' })).rejects.toMatchObject({
        status: 502,
        message: expect.not.stringContaining('SENSITIVE_REMOTE_DETAIL'),
    })
    await expect(queryIgdb({ search: 'game' })).rejects.toMatchObject({
        status: 502,
        message: expect.not.stringContaining('SENSITIVE_REMOTE_DETAIL'),
    })
    vi.stubEnv('IGDB_CLIENT_SECRET', '')
    await expect(queryIgdb({ search: 'game' })).rejects.toMatchObject({ status: 503 })
})

test('credential rotation recreates the IGDB client instead of reusing its cached token', async () => {
    const fetch = vi.fn(async (url: string) =>
        url === 'https://id.twitch.tv/oauth2/token'
            ? Response.json({ access_token: 'synthetic-token', expires_in: 3600 })
            : Response.json([]),
    )
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../../server/utils/igdb')
    await queryIgdb({ search: 'first' })
    vi.stubEnv('IGDB_CLIENT_SECRET', 'synthetic-rotated-secret')
    await queryIgdb({ search: 'second' })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(
        fetch.mock.calls.filter(([url]) => url === 'https://id.twitch.tv/oauth2/token'),
    ).toHaveLength(2)
})

test('Cloudflare Workers redirect: error workaround uses manual mode and blocks 3xx responses', async () => {
    const cancelSpy = vi.fn(async () => undefined)
    let shouldRedirectApi = false
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.redirect === 'error')
            throw new TypeError('Invalid redirect value, must be one of "follow" or "manual"')

        if (url === 'https://id.twitch.tv/oauth2/token')
            return Response.json({ access_token: 'synthetic-token', expires_in: 3600 })

        if (shouldRedirectApi)
            return new Response(new ReadableStream({ cancel: cancelSpy }), { status: 302 })

        return Response.json([{ id: 42, slug: 'zelda', name: 'Zelda' }])
    })
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../../server/utils/igdb')

    expect(await queryIgdb({ search: 'zelda' })).toEqual([
        { igdbId: 42, slug: 'zelda', name: 'Zelda', cover: null },
    ])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ redirect: 'manual' })

    shouldRedirectApi = true
    await expect(queryIgdb({ search: 'zelda' })).rejects.toMatchObject({ status: 502 })
    expect(cancelSpy).toHaveBeenCalledTimes(1)
})

test('an unsettled auth request never poisons subsequent queries across isolated requests', async () => {
    let call = 0
    const fetch = vi.fn((url: string) => {
        call++
        if (call === 1 && url === 'https://id.twitch.tv/oauth2/token')
            return new Promise<Response>(() => {})

        if (url === 'https://id.twitch.tv/oauth2/token')
            return Promise.resolve(Response.json({ access_token: 'fresh-token', expires_in: 3600 }))

        return Promise.resolve(Response.json([{ id: 7, slug: 'zelda', name: 'Zelda' }]))
    })
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../../server/utils/igdb')

    void queryIgdb({ search: 'aborted' }).catch(() => undefined)

    expect(await queryIgdb({ search: 'zelda' })).toEqual([
        { igdbId: 7, slug: 'zelda', name: 'Zelda', cover: null },
    ])
    expect(
        fetch.mock.calls.filter(([url]) => url === 'https://id.twitch.tv/oauth2/token'),
    ).toHaveLength(2)
})

test('cached token returning 401 refreshes once and retries the IGDB request', async () => {
    let tokenCount = 0
    let expireCachedToken = false
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url === 'https://id.twitch.tv/oauth2/token') {
            tokenCount++
            return Response.json({ access_token: `token-${tokenCount}`, expires_in: 3600 })
        }
        const auth = new Headers(init?.headers).get('authorization')
        if (expireCachedToken && auth === 'Bearer token-1')
            return new Response('Unauthorized', { status: 401 })

        return Response.json([{ id: 9, slug: 'valorant', name: 'Valorant' }])
    })
    vi.stubGlobal('fetch', fetch)
    const { queryIgdb } = await import('../../server/utils/igdb')

    await expect(queryIgdb({ search: 'first' })).resolves.toEqual([
        { igdbId: 9, slug: 'valorant', name: 'Valorant', cover: null },
    ])

    expireCachedToken = true
    await expect(queryIgdb({ search: 'second' })).resolves.toEqual([
        { igdbId: 9, slug: 'valorant', name: 'Valorant', cover: null },
    ])
    expect(tokenCount).toBe(2)
    expect(
        fetch.mock.calls.filter(([url]) => url === 'https://api.igdb.com/v4/games'),
    ).toHaveLength(3)
})

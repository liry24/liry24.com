import { useAdmin } from '@liria24/site-admin/server'
import { readBody, getQuery } from 'nuxt/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import get from '../server/api/admin/games/index.get'
import post from '../server/api/admin/games/index.post'
import { savedGames } from '../server/content/gameValidation'
import { queryIgdb } from '../server/utils/igdb'
vi.mock('@liria24/site-admin/server', () => ({ useAdmin: vi.fn() }))
vi.mock('@liria24/site-admin/internal/runtime/nitro2', () => ({
    getNitroRequest: (event: unknown) => event,
}))
vi.mock('nuxt/server', () => ({
    defineEventHandler: (handler: unknown) => handler,
    readBody: vi.fn(),
    getQuery: vi.fn(),
    createError: (error: object) => Object.assign(new Error(), error),
}))
vi.mock('../server/content/gameValidation', () => ({ savedGames: vi.fn() }))
vi.mock('../server/utils/igdb', () => ({ queryIgdb: vi.fn() }))
const game = { igdbId: 1, slug: 'exact--igdb-slug', name: 'Exact Game', cover: null }
const admin = {
    models: vi.fn(async () => []),
    entries: {
        create: vi.fn(),
        list: vi.fn(async () => ({ items: [{ id: 'igdb-1', data: game }] })),
    },
}
const session = vi.fn()
const event = () =>
    ({
        req: new Request('https://test.invalid/api/admin/games', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
        }),
        res: { headers: new Headers() },
    }) as Parameters<typeof post>[0]
beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('requireUserSession', session)
    session.mockResolvedValue({})
    vi.mocked(useAdmin).mockReturnValue(admin as never)
    vi.mocked(savedGames).mockResolvedValue([])
    vi.mocked(readBody).mockResolvedValue({
        igdbId: 1,
        slug: 'untrusted-slug',
        name: 'untrusted name',
    })
    vi.mocked(getQuery).mockReturnValue({})
    vi.mocked(queryIgdb).mockResolvedValue([game])
    admin.entries.list.mockResolvedValue({ items: [{ id: 'igdb-1', data: game }] })
})
afterEach(() => vi.unstubAllGlobals())
test('imports canonical server-refetched metadata using a deterministic identity and ignores client metadata', async () => {
    const request = event()
    expect(await post(request)).toEqual({ ...game, id: 'igdb-1' })
    expect(queryIgdb).toHaveBeenCalledWith({ id: 1 })
    expect(admin.entries.create).toHaveBeenCalledWith('games', {
        id: 'igdb-1',
        data: { ...game, metrics: [] },
    })
    expect(request.res.headers.get('cache-control')).toBe('private, no-store')
    expect(session).toHaveBeenCalledWith(request, { user: { role: 'admin' } })
})
test('existing and simultaneous imports return one identity; unrelated save failures remain errors', async () => {
    vi.mocked(savedGames).mockResolvedValue([{ ...game, id: 'igdb-1', metrics: '[]' }])
    expect(await post(event())).toMatchObject({ id: 'igdb-1' })
    expect(queryIgdb).not.toHaveBeenCalled()
    expect(admin.entries.create).not.toHaveBeenCalled()
    vi.mocked(savedGames)
        .mockResolvedValueOnce([])
        .mockResolvedValue([{ ...game, id: 'igdb-1', metrics: '[]' }])
    admin.entries.create.mockRejectedValue(Error('Duplicate'))
    expect(await post(event())).toMatchObject({ id: 'igdb-1' })
    vi.mocked(savedGames).mockResolvedValue([])
    await expect(post(event())).rejects.toThrow('Duplicate')
})
test('auth, invalid IDs and mismatched remote results stop before mutations', async () => {
    session.mockRejectedValueOnce(Error('No session'))
    await expect(post(event())).rejects.toThrow('No session')
    expect(admin.models).not.toHaveBeenCalled()
    vi.mocked(readBody).mockResolvedValueOnce({ igdbId: '1' })
    await expect(post(event())).rejects.toMatchObject({ statusCode: 400 })
    vi.mocked(queryIgdb).mockResolvedValue([{ ...game, igdbId: 2 }])
    await expect(post(event())).rejects.toMatchObject({ statusCode: 404 })
    expect(admin.entries.create).not.toHaveBeenCalled()
})
test('empty searches use saved games; remote failure keeps local candidates and writing available', async () => {
    expect(await get(event())).toMatchObject({ games: [{ id: 'igdb-1', ...game }], warning: '' })
    expect(queryIgdb).not.toHaveBeenCalled()
    vi.mocked(getQuery).mockReturnValue({ q: 'game' })
    vi.mocked(queryIgdb).mockRejectedValue(Error('Offline'))
    expect(await get(event())).toMatchObject({
        games: [{ id: 'igdb-1', ...game }],
        warning: expect.stringContaining('unavailable'),
    })
})

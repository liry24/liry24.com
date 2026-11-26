import { drizzle } from 'drizzle-orm/node-sqlite'
import { expect, test, vi } from 'vitest'

import importGame from '../server/api/admin/games/index.post'
import database from '../server/databases/default/index'
import { openTestDatabase } from './helpers/database'

const { queryIgdb, useDatabase } = vi.hoisted(() => ({
    queryIgdb: vi.fn(),
    useDatabase: vi.fn(),
}))
vi.mock('../server/utils/auth.js', () => ({ requireAdminSession: vi.fn() }))
vi.mock('../server/utils/igdb.js', () => ({ queryIgdb }))
vi.mock('vite-hub/database', () => ({
    defineDatabase: (definition: unknown) => definition,
    useDatabase,
}))

test('IGDB import writes a live game immediately and concurrent imports share its ID', async () => {
    const fixture = openTestDatabase()
    const db = drizzle({ client: fixture.sqlite })
    useDatabase.mockReturnValue({ db, schema: database.schema })
    const igdbId = 126_459
    queryIgdb.mockResolvedValue([{ igdbId, slug: 'valorant', name: 'Valorant' }])

    const send = () => {
        const url = new URL('https://example.com/api/admin/games')
        return importGame({
            req: new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ igdbId }),
            }),
            url,
            res: { headers: new Headers() },
            context: {},
        })
    }

    try {
        const responses = await Promise.all([send(), send()])
        const expected = {
            id: 'igdb-126459',
            igdbId,
            slug: 'valorant',
            name: 'Valorant',
            cover: null,
        }
        for (const response of responses) expect(response).toEqual(expected)

        expect(await db.select().from(database.schema.gameCatalog)).toEqual([
            {
                id: expected.id,
                igdbId,
                slug: expected.slug,
                data: { igdbId, slug: expected.slug, name: expected.name, order: 0, metrics: [] },
            },
        ])
        queryIgdb.mockClear()
        expect(await send()).toEqual(expected)
        expect(queryIgdb).not.toHaveBeenCalled()
    } finally {
        fixture.close()
    }
})

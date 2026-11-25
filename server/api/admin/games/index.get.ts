import { createError, defineEventHandler, getQuery } from 'nuxt/server'

import { requireAdminSession } from '../../../utils/auth.js'
import { gameCatalog } from '../../../utils/gameCatalog.js'
import { queryIgdb } from '../../../utils/igdb.js'

function isUnconfiguredIgdbError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }
    if ('status' in error && error.status === 503) {
        return true
    }
    return 'statusCode' in error && error.statusCode === 503
}

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const query = String(getQuery(event).q ?? '').trim()
    if (query.length > 100) {
        throw createError({ status: 400, statusText: 'Search is too long' })
    }
    event.res.headers.set('Cache-Control', 'private, no-store')

    const docs = await gameCatalog().list()
    const lowerQuery = query.toLowerCase()
    const games: Array<GameSearchResult> = []

    for (const doc of docs) {
        const { igdbId, slug, name, cover } = doc.data
        if (
            query &&
            !name.toLowerCase().includes(lowerQuery) &&
            !slug.toLowerCase().includes(lowerQuery)
        ) {
            continue
        }
        games.push({
            id: doc.id,
            igdbId,
            slug,
            name,
            cover: cover ?? null,
        })
    }

    games.sort((a, b) => a.name.localeCompare(b.name))
    const limited = games.slice(0, 100)
    if (!query) {
        return { games: limited, warning: '' }
    }

    try {
        const remote = await queryIgdb({ search: query })
        const existingIgdbIds = new Set(docs.map((item) => item.data.igdbId))
        return {
            games: [...limited, ...remote.filter((game) => !existingIgdbIds.has(game.igdbId))],
            warning: '',
        }
    } catch (error) {
        return {
            games: limited,
            warning: isUnconfiguredIgdbError(error)
                ? 'IGDB search is not configured. Saved games are still available.'
                : 'IGDB search is unavailable. Saved games are still available.',
        }
    }
})

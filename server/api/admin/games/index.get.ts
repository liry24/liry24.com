import { createError, defineEventHandler, getQuery } from 'nuxt/server'

import { gameFieldsSchema } from '../../../../shared/schemas/content.js'
import content from '../../../content.js'
import { requireAdminSession } from '../../../utils/auth.js'
import { listAllCollectionItems } from '../../../utils/content.js'
import { queryIgdb } from '../../../utils/igdb.js'

const gameSearchItemSchema = gameFieldsSchema.pick({
    igdbId: true,
    slug: true,
    name: true,
    cover: true,
})

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
    const params = getQuery(event)
    const query = String(params.q ?? '').trim()
    if (query.length > 100) {
        throw createError({ status: 400, statusText: 'Search is too long' })
    }
    event.res.headers.set('Cache-Control', 'private, no-store')

    const slugs = new Set(Array.isArray(params.slug) ? params.slug : [params.slug].filter(Boolean))
    const numericId = /^\d+$/.test(query) ? Number(query) : 0
    const id = Number.isSafeInteger(numericId) && numericId > 0 ? numericId : undefined
    const docs = await listAllCollectionItems(content.collection('games'), 'draft')
    const lowerQuery = query.toLowerCase()
    const saved: Array<GameSearchResult> = []

    for (const doc of docs) {
        const parsed = gameSearchItemSchema.safeParse(doc.data)
        if (!parsed.success) {
            continue
        }
        saved.push({
            id: doc.id,
            igdbId: parsed.data.igdbId,
            slug: parsed.data.slug,
            name: parsed.data.name,
            cover: parsed.data.cover ?? null,
        })
    }

    const sortGames = (a: GameSearchResult, b: GameSearchResult) =>
        Number(b.slug === lowerQuery) - Number(a.slug === lowerQuery) ||
        a.name.localeCompare(b.name)
    if (slugs.size) {
        return { games: saved.filter((game) => slugs.has(game.slug)), warning: '' }
    }
    const limited = saved
        .filter((game) =>
            id !== undefined
                ? game.igdbId === id
                : game.name.toLowerCase().includes(lowerQuery) || game.slug.includes(lowerQuery),
        )
        .sort(sortGames)
        .slice(0, 100)
    if (!query) {
        return { games: limited, warning: '' }
    }

    try {
        if (id !== undefined && limited.length) {
            return { games: limited, warning: '' }
        }
        const remote = await queryIgdb(id === undefined ? { search: query } : { id })
        if (
            gameSlugPattern.test(lowerQuery) &&
            lowerQuery.includes('-') &&
            !limited.some((game) => game.slug === lowerQuery) &&
            !remote.some((game) => game.slug === lowerQuery)
        ) {
            const exact = await queryIgdb({ slug: lowerQuery })
            remote.push(...exact)
        }
        const canonical = new Map(saved.map((game) => [game.igdbId, game]))
        const matches = new Map(limited.map((game) => [game.igdbId, game]))
        for (const game of remote) {
            matches.set(game.igdbId, canonical.get(game.igdbId) ?? game)
        }
        return {
            games: [...matches.values()].sort(sortGames),
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

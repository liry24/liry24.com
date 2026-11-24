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

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const query = String(getQuery(event).q ?? '').trim()
    if (query.length > 100) {
        throw createError({ status: 400, statusText: 'Search is too long' })
    }
    event.res.headers.set('Cache-Control', 'private, no-store')

    const docs = await listAllCollectionItems(content.collection('games'), 'draft')
    const lowerQuery = query.toLowerCase()
    const games: Array<GameSearchResult> = []

    for (const doc of docs) {
        const parsed = gameSearchItemSchema.safeParse(doc.data)
        if (!parsed.success) {
            continue
        }
        if (
            query &&
            !parsed.data.name.toLowerCase().includes(lowerQuery) &&
            !parsed.data.slug.toLowerCase().includes(lowerQuery)
        ) {
            continue
        }
        games.push({
            id: doc.id,
            igdbId: parsed.data.igdbId,
            slug: parsed.data.slug,
            name: parsed.data.name,
            cover: parsed.data.cover ?? null,
        })
    }

    games.sort((a, b) => a.name.localeCompare(b.name))
    const limited = games.slice(0, 100)
    if (!query) {
        return { games: limited, warning: '' }
    }

    try {
        const remote = await queryIgdb({ search: query })
        const existingIgdbIds = new Set(limited.map((item) => item.igdbId))
        return {
            games: [...limited, ...remote.filter((game) => !existingIgdbIds.has(game.igdbId))],
            warning: '',
        }
    } catch {
        return {
            games: limited,
            warning: 'IGDB search is unavailable. Saved games are still available.',
        }
    }
})

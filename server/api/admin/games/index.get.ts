import { useAdmin } from 'liti/nuxt/server'
import { defineEventHandler, getQuery, createError } from 'nuxt/server'

export default defineEventHandler(async (event) => {
    await requireAdminPermission(event, { 'liti:model:games': ['readDraft'] })
    const admin = useAdmin(event)
    const query = String(getQuery(event).q ?? '').trim()
    if (query.length > 100)
        throw createError({ statusCode: 400, statusMessage: 'Search is too long' })
    event.res.headers.set('Cache-Control', 'private, no-store')
    const local = await admin.entries.list('games', { q: query, limit: 100 })
    const games = local.items.map((entry) => ({
        id: entry.id,
        igdbId: entry.data.igdbId,
        slug: entry.data.slug,
        name: entry.data.name,
        cover: entry.data.cover,
    }))
    if (!query) return { games, warning: '' }
    try {
        const remote = await queryIgdb({ search: query })
        return {
            games: [
                ...games,
                ...remote.filter((game) => !games.some((local) => local.igdbId === game.igdbId)),
            ],
            warning: '',
        }
    } catch {
        return { games, warning: 'IGDB search is unavailable. Saved games are still available.' }
    }
})

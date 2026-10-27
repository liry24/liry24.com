import { validateData } from '@litijs/model'
import { sql } from 'drizzle-orm'
import { defineEventHandler, getQuery, createError } from 'nuxt/server'
import { db } from 'vite-hub/database/drizzle'

import { tables } from '../../../database/records'
import { games as definition } from '../../../models/records'

export default defineEventHandler(async (event) => {
    await requireAdminPermission(event, { 'liti:model:games': ['readDraft'] })
    const query = String(getQuery(event).q ?? '').trim()
    if (query.length > 100) throw createError({ status: 400, statusText: 'Search is too long' })
    event.res.headers.set('Cache-Control', 'private, no-store')
    const table = tables.games
    const pattern = '%' + query.replace(/[\\%_]/g, '\\$&').toLowerCase() + '%'
    const rows = await db
        .select({
            id: table.id,
            igdbId: table.igdbId,
            slug: table.slug,
            name: table.name,
            cover: table.cover,
        })
        .from(table)
        .where(
            query
                ? sql`lower(${table.name}) LIKE ${pattern} ESCAPE ${'\\'} OR lower(${table.slug}) LIKE ${pattern} ESCAPE ${'\\'}`
                : undefined,
        )
        .limit(100)
    const games = await Promise.all(
        rows.map(async (row) => ({
            id: row.id,
            cover: row.cover,
            ...(await validateData(
                {
                    igdbId: definition.fields.igdbId,
                    slug: definition.fields.slug,
                    name: definition.fields.name,
                },
                { igdbId: row.igdbId, slug: row.slug, name: row.name },
            )),
        })),
    )
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

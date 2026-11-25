import { createError, defineEventHandler, readBody } from 'nuxt/server'
import { z } from 'zod'

import { gameFieldsSchema } from '../../../../shared/schemas/content.js'
import { requireAdminSession } from '../../../utils/auth.js'
import { gameCatalog } from '../../../utils/gameCatalog.js'
import { queryIgdb } from '../../../utils/igdb.js'

const importPayloadSchema = z.object({
    igdbId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    if (!event.req.headers.get('content-type')?.startsWith('application/json')) {
        throw createError({ status: 415, statusText: 'JSON required' })
    }
    const input = importPayloadSchema.safeParse(await readBody(event))
    if (!input.success) {
        throw createError({ status: 400, statusText: 'Choose an IGDB game' })
    }
    event.res.headers.set('Cache-Control', 'private, no-store')

    const id = `igdb-${input.data.igdbId}`
    const games = gameCatalog()
    const existing = await games.byIgdbId(input.data.igdbId)
    if (existing) {
        const { igdbId, slug, name, cover } = existing.data
        return {
            id: existing.id,
            igdbId,
            slug,
            name,
            cover: cover ?? null,
        }
    }

    const remoteGames = await queryIgdb({ id: input.data.igdbId })
    const game = remoteGames.find((entry) => entry.igdbId === input.data.igdbId)
    if (!game) {
        throw createError({ status: 404, statusText: 'Game not found in IGDB' })
    }

    await games.insert(id, gameFieldsSchema.parse({ ...game, cover: game.cover ?? undefined }))
    const saved = await games.byIgdbId(game.igdbId)
    if (!saved) {
        throw createError({ status: 409, statusText: 'The game changed. Reload and try again.' })
    }
    const { igdbId, slug, name, cover } = saved.data
    return { id: saved.id, igdbId, slug, name, cover: cover ?? null }
})

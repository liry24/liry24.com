import { getNitroRequest } from '@liria24/site-admin/internal/runtime/nitro2'
import { useAdmin } from '@liria24/site-admin/server'
import { defineEventHandler, readBody, createError } from 'nuxt/server'
import { z } from 'zod'

import { savedGames } from '../../../content/gameValidation'
import { queryIgdb } from '../../../utils/igdb'
export default defineEventHandler(async (event) => {
    await requireUserSession(getNitroRequest(event), { user: { role: 'admin' } })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ statusCode: 415, statusMessage: 'JSON required' })
    const admin = useAdmin(event)
    await admin.models()
    const input = z.object({ igdbId: z.number().int().positive() }).safeParse(await readBody(event))
    if (!input.success) throw createError({ statusCode: 400, statusMessage: 'Choose an IGDB game' })
    event.res.headers.set('Cache-Control', 'private, no-store')
    const existing = (await savedGames()).find((game) => game.igdbId === input.data.igdbId)
    if (existing) return { ...existing, metrics: undefined }
    const game = (await queryIgdb({ id: input.data.igdbId })).find(
        (game) => game.igdbId === input.data.igdbId,
    )
    if (!game) throw createError({ statusCode: 404, statusMessage: 'Game not found in IGDB' })
    const id = `igdb-${game.igdbId}`
    try {
        await admin.entries.create('games', { id, data: { ...game, metrics: [] } })
    } catch (error) {
        // Deterministic entry IDs make simultaneous imports idempotent.
        if (!(await savedGames()).some((entry) => entry.id === id && entry.igdbId === game.igdbId))
            throw error
    }
    return { ...game, id }
})

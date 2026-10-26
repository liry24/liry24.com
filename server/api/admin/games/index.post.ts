import { useAdmin } from 'liti/nuxt/server'
import { defineEventHandler, readBody, createError } from 'nuxt/server'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
    await requireAdminPermission(event, { 'liti:model:games': ['create'] })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ status: 415, statusText: 'JSON required' })
    const admin = useAdmin(event)
    await admin.models()
    const input = z.object({ igdbId: z.number().int().positive() }).safeParse(await readBody(event))
    if (!input.success) throw createError({ status: 400, statusText: 'Choose an IGDB game' })
    event.res.headers.set('Cache-Control', 'private, no-store')
    const id = `igdb-${input.data.igdbId}`
    const saved = async () => {
        try {
            return await admin.entries.get('games', id)
        } catch (error) {
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'LITI_ENTRY_NOT_FOUND'
            )
                return null
            throw error
        }
    }
    const existing = await saved()
    if (existing) return { ...existing.data, id: existing.id, metrics: undefined }
    const game = (await queryIgdb({ id: input.data.igdbId })).find(
        (game) => game.igdbId === input.data.igdbId,
    )
    if (!game) throw createError({ status: 404, statusText: 'Game not found in IGDB' })
    try {
        await admin.entries.create('games', { id, data: { ...game, metrics: [] } })
    } catch (error) {
        // Deterministic entry IDs make simultaneous imports idempotent.
        const existing = await saved()
        if (existing?.data.igdbId !== game.igdbId) throw error
    }
    return { ...game, id }
})

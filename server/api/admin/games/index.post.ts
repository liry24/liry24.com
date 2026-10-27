import { validateData } from '@litijs/model'
import { defineEventHandler, readBody, createError } from 'nuxt/server'
import { z } from 'zod'

import runtime from '#liti/runtime'

import { games } from '../../../models/records'

export default defineEventHandler(async (event) => {
    const session = await requireAdminPermission(event, { 'liti:model:games': ['create'] })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ status: 415, statusText: 'JSON required' })
    const records = runtime.records
    const input = z.object({ igdbId: z.number().int().positive() }).safeParse(await readBody(event))
    if (!input.success) throw createError({ status: 400, statusText: 'Choose an IGDB game' })
    event.res.headers.set('Cache-Control', 'private, no-store')
    const id = `igdb-${input.data.igdbId}`
    const saved = () => records.readDraft('games', id, { actor: session.user })
    const existing = await saved()
    if (existing) {
        const data = await validateData(games.fields, existing.data)
        return {
            id: existing.id,
            igdbId: data.igdbId,
            slug: data.slug,
            name: data.name,
            cover: data.cover,
        }
    }
    const game = (await queryIgdb({ id: input.data.igdbId })).find(
        (game) => game.igdbId === input.data.igdbId,
    )
    if (!game) throw createError({ status: 404, statusText: 'Game not found in IGDB' })
    try {
        await records.save(
            'games',
            id,
            { ...game, cover: game.cover ?? undefined, order: 0, metrics: [] },
            { actor: session.user, ifVersion: null },
        )
    } catch (error) {
        // Deterministic entry IDs make simultaneous imports idempotent.
        const existing = await saved()
        if (existing?.data.igdbId !== game.igdbId) throw error
    }
    return { ...game, id }
})

import { createError, defineEventHandler, readBody } from 'nuxt/server'
import { z } from 'zod'

import { gameFieldsSchema } from '../../../../shared/schemas/content.js'
import content from '../../../content.js'
import { requireAdminSession } from '../../../utils/auth.js'

const importPayloadSchema = z.object({
    igdbId: z.number().int().positive(),
    publish: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
    const session = await requireAdminSession(event)
    if (!event.req.headers.get('content-type')?.startsWith('application/json')) {
        throw createError({ status: 415, statusText: 'JSON required' })
    }
    const input = importPayloadSchema.safeParse(await readBody(event))
    if (!input.success) {
        throw createError({ status: 400, statusText: 'Choose an IGDB game' })
    }
    event.res.headers.set('Cache-Control', 'private, no-store')

    const id = `igdb-${input.data.igdbId}`
    const games = content.collection('games')
    const existing = await games.get(id, { ref: 'draft' })
    if (existing) {
        const parsedExisting = gameFieldsSchema.parse(existing.data)
        return {
            id: existing.id,
            igdbId: parsedExisting.igdbId,
            slug: parsedExisting.slug,
            name: parsedExisting.name,
            cover: parsedExisting.cover ?? null,
        }
    }

    const remoteGames = await queryIgdb({ id: input.data.igdbId })
    const game = remoteGames.find((entry) => entry.igdbId === input.data.igdbId)
    if (!game) {
        throw createError({ status: 404, statusText: 'Game not found in IGDB' })
    }

    try {
        const saved = await games.save(id, {
            data: {
                igdbId: game.igdbId,
                slug: game.slug,
                name: game.name,
                cover: game.cover ?? undefined,
                order: 0,
                metrics: [],
            },
        })
        if (input.data.publish && saved.digest) {
            await content.publish({
                expect: [{ collection: 'games', id, digest: saved.digest }],
                metadata: { actorUserId: session.user.id },
            })
        }
    } catch (error) {
        // Deterministic entry IDs make concurrent imports idempotent.
        const fallback = await games.get(id, { ref: 'draft' })
        if (!fallback || Number(fallback.data.igdbId) !== game.igdbId) {
            throw error
        }
    }

    return { ...game, id }
})

import { z } from 'zod'

const importPayloadSchema = z.object({
    igdbId: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ status: 415, statusText: 'JSON required' })

    const input = importPayloadSchema.safeParse(await readBody(event))
    if (!input.success) throw createError({ status: 400, statusText: 'Choose an IGDB game' })

    event.res.headers.set('Cache-Control', 'private, no-store')

    const existing = await gameCatalog().byIgdbId(input.data.igdbId)
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

    const remoteGame = await resolveRemoteCatalogGame({ id: input.data.igdbId })
    const saved = await insertCatalogGame(remoteGame)
    const { igdbId, slug, name, cover } = saved.data
    return { id: saved.id, igdbId, slug, name, cover: cover ?? null }
})

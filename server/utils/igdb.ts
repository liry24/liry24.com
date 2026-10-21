import { createIgdbClient, eq, type IgdbClient } from '@liry24/igdb'
import { createError } from 'nuxt/server'
import { z } from 'zod'

const result = z.array(
    z.object({
        id: z.number().int().positive(),
        slug: z.string().regex(gameSlugPattern),
        name: z.string().min(1),
        cover: z.object({ image_id: z.string().regex(/^[a-zA-Z0-9_]+$/) }).optional(),
    }),
)

let cached: { clientId: string; clientSecret: string; client: IgdbClient } | undefined

export async function queryIgdb(
    query: { search: string } | { id: number },
): Promise<GameSearchResult[]> {
    const client = process.env.IGDB_CLIENT_ID,
        secret = process.env.IGDB_CLIENT_SECRET

    if (!client || !secret)
        throw createError({
            statusCode: 503,
            statusMessage: 'IGDB search is not configured. Saved games are still available.',
        })

    try {
        if (!cached || cached.clientId !== client || cached.clientSecret !== secret) {
            cached = {
                clientId: client,
                clientSecret: secret,
                client: createIgdbClient({
                    clientId: client,
                    clientSecret: secret,
                    timeoutMs: 5000,
                }),
            }
        }
        const games = cached.client.query('games').fields('id', 'slug', 'name', 'cover.image_id')
        const response = await ('id' in query
            ? games.where((game) => eq(game.id, query.id)).limit(1)
            : games.search(query.search).limit(10))
        return result.parse(response).map((game) => ({
            igdbId: game.id,
            slug: game.slug,
            name: game.name,
            cover: game.cover
                ? `https://images.igdb.com/igdb/image/upload/t_thumb/${game.cover.image_id}.jpg`
                : null,
        }))
    } catch {
        throw createError({
            status: 502,
            statusText: 'IGDB is unavailable. Continue writing or choose a saved game.',
        })
    }
}

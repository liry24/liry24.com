import { createError } from 'nuxt/server'
import { z } from 'zod'

import { gameSlugPattern } from '../../shared/utils/games'
import type { GameSearchResult } from '../../shared/utils/igdb'

const result = z.array(
    z.object({
        id: z.number().int().positive(),
        slug: z.string().regex(gameSlugPattern),
        name: z.string().min(1),
        cover: z.object({ image_id: z.string().regex(/^[a-zA-Z0-9_]+$/) }).optional(),
    }),
)

let token: { client: string; value: string; until: number } | undefined

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
        if (!token || token.client !== client || token.until < Date.now()) {
            const response = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                body: new URLSearchParams({
                    client_id: client,
                    client_secret: secret,
                    grant_type: 'client_credentials',
                }),
                signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) throw Error('IGDB authorization unavailable')
            const credentials = z
                .object({ access_token: z.string(), expires_in: z.number().positive() })
                .parse(await response.json())
            token = {
                client,
                value: credentials.access_token,
                until: Date.now() + (credentials.expires_in - 60) * 1000,
            }
        }
        const condition =
            'id' in query ? `where id = ${query.id};` : `search ${JSON.stringify(query.search)};`
        const response = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': client,
                Authorization: `Bearer ${token.value}`,
                'Content-Type': 'text/plain',
            },
            body: `fields id,slug,name,cover.image_id; ${condition} limit 10;`,
            signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) throw Error('IGDB search unavailable')
        return result.parse(await response.json()).map((game) => ({
            igdbId: game.id,
            slug: game.slug,
            name: game.name,
            cover: game.cover
                ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${game.cover.image_id}.jpg`
                : null,
        }))
    } catch {
        throw createError({
            status: 502,
            statusText: 'IGDB is unavailable. Continue writing or choose a saved game.',
        })
    }
}

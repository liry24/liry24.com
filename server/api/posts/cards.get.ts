import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import { z } from 'zod'

import type { PostItem } from '../../../shared/schemas/content.js'
import content from '../../content.js'
import { listAllCollectionItems } from '../../utils/content.js'

const postTimestamp = (entry: PostItem) =>
    Date.parse(String(entry.data.authoredAt ?? entry.publishedAt ?? '')) || 0

export default defineEventHandler(async (event) => {
    const parsed = z
        .object({
            game: z.string().regex(gameSlugPattern).optional(),
            limit: z.coerce.number().int().min(1).max(1000).default(20),
            offset: z.coerce.number().int().nonnegative().default(0),
        })
        .safeParse(getQuery(event))
    if (!parsed.success) {
        throw createError({ status: 400, statusText: 'Invalid post query' })
    }
    const input = parsed.data

    const collection = content.collection('posts')
    const summaries = await listAllCollectionItems(collection, 'published')
    const fullDocs = await Promise.all(
        summaries.map((summary) => collection.get(summary.id, { ref: 'published' })),
    )
    const entries: Array<PostItem> = []
    for (const full of fullDocs) {
        if (!full) {
            continue
        }
        entries.push({
            id: full.id,
            url: full.url ?? null,
            data: full.data,
            body: full.body,
            publishedAt: full.data.authoredAt,
            updatedAt: full.data.authoredAt,
        })
    }

    let gameId: string | undefined
    if (input.game) {
        const games = await listAllCollectionItems(content.collection('games'), 'published')
        gameId = games.find((doc) => doc.data.slug === input.game)?.id
    }

    const selected = entries.filter(
        (entry) =>
            !input.game ||
            (typeof gameId === 'string' &&
                Array.isArray(entry.data.gameMentions) &&
                entry.data.gameMentions.includes(gameId)),
    )

    selected.sort((a, b) => postTimestamp(b) - postTimestamp(a) || a.id.localeCompare(b.id))

    const page = selected.slice(input.offset, input.offset + input.limit)
    return {
        items: await postCards(page),
        total: selected.length,
    }
})

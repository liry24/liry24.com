import { z } from 'zod'

import content from '#server/content'

const postTimestamp = (entry: { data: PostData; updatedAt?: string | null }) =>
    Date.parse(entry.data.authoredAt ?? entry.updatedAt ?? '') || 0

export default defineEventHandler(async (event): Promise<PostCardsPage> => {
    const parsed = z
        .object({
            game: z.string().regex(gameSlugPattern).optional(),
            limit: z.coerce.number().int().min(1).max(1000).default(20),
            offset: z.coerce.number().int().nonnegative().default(0),
        })
        .safeParse(getQuery(event))
    if (!parsed.success) throw createError({ status: 400, statusText: 'Invalid post query' })

    const input = parsed.data
    const collection = content.collection('posts')
    const [summaries, game] = await Promise.all([
        listAllCollectionItems(collection, 'published'),
        input.game ? gameCatalog().bySlug(input.game) : undefined,
    ])

    const selected = input.game
        ? game
            ? summaries.filter((entry) => entry.data.gameMentions.includes(game.id))
            : []
        : summaries

    selected.sort((a, b) => postTimestamp(b) - postTimestamp(a) || a.id.localeCompare(b.id))

    const pageSummaries = selected.slice(input.offset, input.offset + input.limit)
    const page: Array<PostItem> = await Promise.all(
        pageSummaries.map(async (summary) => {
            const full = await collection.get(summary.id, { ref: 'published' })
            const updatedAt = full?.updatedAt ?? summary.updatedAt ?? undefined
            return {
                id: summary.id,
                url: full?.url ?? summary.url ?? null,
                data: full?.data ?? summary.data,
                body: full?.body ?? '',
                publishedAt: updatedAt,
                updatedAt,
            }
        }),
    )

    return {
        items: await postCards(page),
        total: selected.length,
    }
})

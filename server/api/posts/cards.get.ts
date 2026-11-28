import { z } from 'zod'

import content from '#server/content'

const postTimestamp = (entry: { data: PostData; updatedAt?: string | null }) =>
    Date.parse(entry.data.authoredAt ?? entry.updatedAt ?? '') || 0

export default defineEventHandler(async (event): Promise<PostCardsPage | Response> => {
    const parsed = z
        .object({
            game: z.string().regex(gameSlugPattern).optional(),
            limit: z.coerce.number().int().min(1).max(1000).default(20),
            offset: z.coerce.number().int().nonnegative().default(0),
        })
        .safeParse(getQuery(event))
    if (!parsed.success) throw createError({ status: 400, statusText: 'Invalid post query' })

    const input = parsed.data
    const catalog = gameCatalog()
    const filterGame = input.game ? await catalog.bySlug(input.game) : undefined
    if (input.game && !filterGame) return { items: [], total: 0, games: {} }

    const snapshot = await getPublishedPostsSnapshot()
    const revision = snapshot.revision
    const etag = `post-cards-${revision ?? 'empty'}-${input.game ?? ''}-${input.limit}-${input.offset}`
    if (applyPublicCacheHeaders(event, etag)) return new Response(null, { status: 304 })

    if (!revision) {
        return {
            items: [],
            total: 0,
            games: filterGame ? gameMentionDataBySlug([filterGame]) : {},
        }
    }

    const collection = content.collection('posts')
    const selected = filterGame
        ? snapshot.items.filter((entry) => entry.data.gameMentions.includes(filterGame.id))
        : [...snapshot.items]
    selected.sort((a, b) => postTimestamp(b) - postTimestamp(a) || a.id.localeCompare(b.id))

    const pageSummaries = selected.slice(input.offset, input.offset + input.limit)
    const page = await Promise.all(
        pageSummaries.map(async (summary) => {
            const full = await collection.get(summary.id, { revision })
            const updatedAt = full?.updatedAt ?? summary.updatedAt ?? undefined
            return {
                id: summary.id,
                url: full?.url ?? summary.url ?? null,
                data: full?.data ?? summary.data,
                body: full?.body ?? '',
                digest: full?.digest,
                publishedAt: updatedAt,
                updatedAt,
            }
        }),
    )

    const gameIds = new Set(page.flatMap(({ data }) => data.gameMentions))
    if (filterGame) gameIds.add(filterGame.id)
    const [items, games] = await Promise.all([
        postCards(page, getParsedPostContent),
        catalog.byIds([...gameIds]),
    ])
    return {
        items,
        total: selected.length,
        games: gameMentionDataBySlug(games),
    }
})

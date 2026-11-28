import content from '#server/content'

export default defineEventHandler(async (event): Promise<GameCatalogResponse> => {
    await requireAdminSession(event)
    event.res.headers.set('Cache-Control', 'private, no-store')
    const query = getQuery(event)
    if (query.meta !== '1' && query.meta !== 'true')
        return { items: await gameCatalog().listOrdered() }

    const statsCol = content.collection('gameStats')
    const postsCol = content.collection('posts')
    const [items, draftStats, publishedStats, draftPosts, publishedPosts] = await Promise.all([
        gameCatalog().listOrdered(),
        listAllCollectionItems(statsCol, 'draft'),
        listAllCollectionItems(statsCol, 'published'),
        listAllCollectionItems(postsCol, 'draft'),
        listAllCollectionItems(postsCol, 'published'),
    ])

    const postIdsByGame = new Map<string, Set<string>>()
    for (const post of [...draftPosts, ...publishedPosts]) {
        for (const gameId of post.data.gameMentions ?? []) {
            let set = postIdsByGame.get(gameId)
            if (!set) {
                set = new Set()
                postIdsByGame.set(gameId, set)
            }
            set.add(post.id)
        }
    }

    const publishedKeysByGame = new Map<string, Set<string>>()
    for (const stat of publishedStats) {
        let set = publishedKeysByGame.get(stat.data.game)
        if (!set) {
            set = new Set()
            publishedKeysByGame.set(stat.data.game, set)
        }
        for (const value of stat.data.values ?? []) set.add(value.key)
    }

    const draftStatIdsByGame = new Map<string, Map<string, Array<string>>>()
    for (const stat of draftStats) {
        let byKey = draftStatIdsByGame.get(stat.data.game)
        if (!byKey) {
            byKey = new Map()
            draftStatIdsByGame.set(stat.data.game, byKey)
        }
        for (const value of stat.data.values ?? []) {
            let ids = byKey.get(value.key)
            if (!ids) {
                ids = []
                byKey.set(value.key, ids)
            }
            ids.push(stat.id)
        }
    }

    const meta: Record<string, GameCatalogMeta> = {}
    for (const item of items) {
        const draftByKey = draftStatIdsByGame.get(item.id)
        meta[item.id] = {
            postCount: postIdsByGame.get(item.id)?.size ?? 0,
            publishedMetricKeys: [...(publishedKeysByGame.get(item.id) ?? [])],
            draftMetricStatIds: draftByKey ? Object.fromEntries(draftByKey.entries()) : {},
        }
    }

    return { items, meta }
})

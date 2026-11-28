import content from '#server/content'

export default defineEventHandler(async (): Promise<GameStatsPage> => {
    const items = await listAllCollectionItems(content.collection('gameStats'), 'published')
    items.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))

    const referencedIds = new Set(items.map((item) => item.data.game))
    const games = await gameCatalog().byIds([...referencedIds])
    const gameDisplays = games
        .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
        .map(({ id, data: { slug, name, cover, icon, primaryMetric, metrics } }) => ({
            id,
            data: { slug, name, cover, icon, primaryMetric, metrics },
        }))
    return {
        items: items.map(({ id, data }) => ({ id, data })),
        total: items.length,
        games: gameDisplays,
    }
})

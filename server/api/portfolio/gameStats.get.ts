import content from '#server/content'

export default defineEventHandler(async (): Promise<GameStatsPage> => {
    const items = await listAllCollectionItems(content.collection('gameStats'), 'published')
    items.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))

    const referencedIds = new Set(items.map((item) => item.data.game))
    const games = referencedIds.size ? await gameCatalog().list() : []
    const gameDisplays = games
        .filter((game) => referencedIds.has(game.id))
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

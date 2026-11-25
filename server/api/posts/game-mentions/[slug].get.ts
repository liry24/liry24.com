export default defineEventHandler(async (event): Promise<GameMentionData | null> => {
    const slug = getRouterParam(event, 'slug')
    if (!slug || !gameSlugPattern.test(slug)) {
        return null
    }
    const game = await gameCatalog().bySlug(slug)
    if (!game) {
        return null
    }
    const { name, icon, cover } = game.data
    return { slug, name, icon, cover }
})

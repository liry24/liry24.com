const portfolioModels = [
    'works',
    'arts',
    'careers',
    'skills',
    'socials',
] as const satisfies ReadonlyArray<PortfolioCollectionName>

export default defineEventHandler(async (event) => {
    const raw = getRouterParam(event, 'model')
    const name = portfolioModels.find((entry) => entry === raw)
    if (!name) throw createError({ status: 404, statusText: 'Collection not found' })

    const revision = await getPublishedRevision()
    if (applyPublicCacheHeaders(event, `portfolio-${name}-${revision ?? 'empty'}`)) {
        // H3 omits the body for 304 responses.
        return { items: [], total: 0 }
    }

    const items = await listCollectionByName(name, 'published')
    items.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    return { items: items.map(({ id, data }) => ({ id, data })), total: items.length }
})

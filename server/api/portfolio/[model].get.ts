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

    const items = await listCollectionByName(name, 'published')
    items.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    return { items: items.map(({ id, data }) => ({ id, data })), total: items.length }
})

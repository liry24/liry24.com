function isUnconfiguredIgdbError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    if ('status' in error && error.status === 503) return true

    return 'statusCode' in error && error.statusCode === 503
}

export default defineEventHandler(async (event): Promise<GameSearchResponse> => {
    await requireAdminSession(event)
    const params = getQuery(event)
    const query = String(params.q ?? '').trim()
    if (query.length > 100) throw createError({ status: 400, statusText: 'Search is too long' })

    event.res.headers.set('Cache-Control', 'private, no-store')

    const slugs = Array.isArray(params.slug) ? params.slug : params.slug ? [params.slug] : []
    const numericId = /^\d+$/.test(query) ? Number(query) : 0
    const id = Number.isSafeInteger(numericId) && numericId > 0 ? numericId : undefined
    const catalog = gameCatalog()
    let docs: Array<GameCatalogItem>
    if (slugs.length) docs = await catalog.bySlugs(slugs)
    else if (id === undefined) docs = await catalog.list()
    else {
        const match = await catalog.byIgdbId(id)
        docs = match ? [match] : []
    }

    const lowerQuery = query.toLowerCase()
    const saved: Array<GameSearchResult> = []

    for (const doc of docs) {
        const { igdbId, slug, name, cover, icon } = doc.data
        saved.push({
            id: doc.id,
            igdbId,
            slug,
            name,
            cover: cover ?? null,
            icon: icon ?? null,
        })
    }

    if (slugs.length || (id !== undefined && saved.length)) return { games: saved, warning: '' }

    const sortGames = (a: GameSearchResult, b: GameSearchResult) =>
        Number(b.slug === lowerQuery) - Number(a.slug === lowerQuery) ||
        a.name.localeCompare(b.name)

    const limited = saved
        .filter(
            (game) =>
                game.name.toLowerCase().includes(lowerQuery) || game.slug.includes(lowerQuery),
        )
        .sort(sortGames)
        .slice(0, 100)
    if (!query) return { games: limited, warning: '' }

    try {
        const remoteResult = await queryIgdbWithSource(
            id === undefined ? { search: query } : { id },
        )
        const remote = [...remoteResult.games]
        if (
            gameSlugPattern.test(lowerQuery) &&
            lowerQuery.includes('-') &&
            !limited.some((game) => game.slug === lowerQuery) &&
            !remote.some((game) => game.slug === lowerQuery)
        ) {
            const exact = await queryIgdbWithSource({ slug: lowerQuery })
            remote.push(...exact.games)
        }
        const canonical = new Map(saved.map((game) => [game.igdbId, game]))
        const matches = new Map(limited.map((game) => [game.igdbId, game]))
        for (const game of remote) matches.set(game.igdbId, canonical.get(game.igdbId) ?? game)

        return {
            games: [...matches.values()].sort(sortGames),
            warning: '',
            source: remoteResult.source,
        }
    } catch (error) {
        return {
            games: limited,
            warning: isUnconfiguredIgdbError(error)
                ? 'IGDB search is not configured. Saved games are still available.'
                : 'IGDB search is unavailable. Saved games are still available.',
        }
    }
})

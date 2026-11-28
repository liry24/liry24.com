import content from '#server/content'

export interface PostGameHint {
    slug: string
    igdbId: number
}

function invalidField(message: string): never {
    throw createError({ status: 400, statusText: message, message })
}

async function resolveMissingMentionGame(
    slug: string,
    hintIgdbId?: number,
): Promise<GameSearchResult | undefined> {
    if (hintIgdbId !== undefined) {
        const byId = await queryIgdb({ id: hintIgdbId })
        const matched = byId.find((entry) => entry.igdbId === hintIgdbId && entry.slug === slug)
        if (matched) return matched
    }
    const bySlug = await queryIgdb({ slug })
    return bySlug.find((entry) => entry.slug === slug)
}

export async function resolvePostGames(
    title: string,
    body: string,
    mentionedGames?: Array<PostGameHint>,
): Promise<
    Pick<PostData, 'plainTitle' | 'gameMentions'> & {
        persistMissingGames: () => Promise<void>
    }
> {
    const slugs = await postGameSlugs(title, body)
    const catalog = gameCatalog()
    const gameDocs = await catalog.bySlugs(slugs)
    const bySlug = new Map(gameDocs.map((doc) => [doc.data.slug, doc]))
    const hints = new Map((mentionedGames ?? []).map((entry) => [entry.slug, entry.igdbId]))
    const matchedIds: Array<string> = []
    const resolvedNames = new Map<string, string>()
    const missingRemote: Array<GameSearchResult> = []

    for (let offset = 0; offset < slugs.length; offset += 3) {
        const matches = await Promise.all(
            slugs.slice(offset, offset + 3).map(async (slug) => {
                const doc = bySlug.get(slug)
                if (doc) return { slug, id: doc.id, name: doc.data.name }

                const remote = await resolveMissingMentionGame(slug, hints.get(slug)).catch(
                    () => undefined,
                )
                if (!remote) invalidField('Choose a valid game for every game mention.')

                const existing = await catalog.byIgdbId(remote.igdbId)
                if (existing) return { slug, id: existing.id, name: existing.data.name }

                return { slug, id: catalogGameId(remote.igdbId), name: remote.name, remote }
            }),
        )
        for (const { slug, id, name, remote } of matches) {
            matchedIds.push(id)
            resolvedNames.set(slug, name)
            if (remote) missingRemote.push(remote)
        }
    }

    const plainTitle = gameTitleParts(title)
        .map((part) => {
            if (!part.slug) return part.text

            return resolvedNames.get(part.slug) ?? part.text
        })
        .join('')

    return {
        plainTitle,
        gameMentions: matchedIds,
        async persistMissingGames() {
            for (const remote of missingRemote) {
                const existing = await catalog.byIgdbId(remote.igdbId)
                if (!existing) await insertCatalogGame(remote)
            }
        },
    }
}

export async function validateGameMetrics(options: {
    gameId?: string
    metrics: GameRecordData['metrics']
    primaryMetric?: string
    previousMetrics?: GameRecordData['metrics']
    ignoreDraftStatId?: string
}) {
    const { gameId, metrics, primaryMetric, previousMetrics, ignoreDraftStatId } = options
    const metricKeys = new Set(metrics.map((item) => item.key))
    if (metricKeys.size !== metrics.length) invalidField('Metric keys must be unique.')

    if (primaryMetric && !metrics.some((item) => item.key === primaryMetric))
        invalidField('Choose an existing metric.')

    for (const metric of metrics) {
        for (const position of metric.positions ?? []) {
            const issues = gameValueIssues([metric], [{ ...position, key: metric.key }])
            const firstIssue = issues[0]
            if (firstIssue) invalidField(firstIssue)
        }
    }

    if (!gameId || !previousMetrics) return

    const stats = content.collection('gameStats')
    const [draft, published] = await Promise.all([
        listAllCollectionItems(stats, 'draft'),
        listAllCollectionItems(stats, 'published'),
    ])
    const relevantStats = [
        ...published,
        ...draft.filter((doc) => !ignoreDraftStatId || doc.id !== ignoreDraftStatId),
    ]
    const recordedKeys = new Set(
        relevantStats
            .filter((doc) => doc.data.game === gameId)
            .flatMap((doc) => (Array.isArray(doc.data.values) ? doc.data.values : []))
            .map((entry) =>
                entry &&
                typeof entry === 'object' &&
                'key' in entry &&
                typeof entry.key === 'string'
                    ? entry.key
                    : '',
            ),
    )
    for (const key of recordedKeys) {
        if (!key) continue

        const before = previousMetrics.find((metric) => metric.key === key)
        const after = metrics.find((metric) => metric.key === key)
        if (
            !after ||
            after.format !== before?.format ||
            (after.unit || '') !== (before?.unit || '')
        )
            invalidField(`Keep the key, format and unit of recorded metric ${key}.`)
    }
}

export async function validateGameSave(options: {
    id: string
    data: GameRecordData
    previous: GameRecordData
}) {
    const { id, data, previous } = options
    if (
        previous.igdbId !== data.igdbId ||
        previous.slug !== data.slug ||
        previous.name !== data.name
    )
        invalidField('IGDB identity cannot be edited.')

    await validateGameMetrics({
        gameId: id,
        metrics: data.metrics,
        primaryMetric: data.primaryMetric,
        previousMetrics: previous.metrics,
    })
}

export async function validateGameStatsSave(options: {
    id: string
    data: Omit<GameStatsRecordData, 'order'>
    game?: GameRecordData
}) {
    const { id, data } = options
    if (data.start && data.end && Date.parse(data.start) > Date.parse(data.end))
        invalidField('End must follow start.')

    const game = options.game ?? (await gameCatalog().get(data.game))?.data
    if (!game) invalidField('Choose a valid game.')

    const issues = gameValueIssues(game.metrics, data.values)
    const firstIssue = issues[0]
    if (firstIssue) invalidField(firstIssue)

    const existing = await listAllCollectionItems(content.collection('gameStats'), 'draft')
    for (const doc of existing) {
        if (doc.id === id) continue

        if (doc.data.game === data.game && doc.data.periodKey === data.periodKey)
            invalidField('A stat period with this game and periodKey already exists.')
    }
}

async function gameStatsEntries() {
    const stats = content.collection('gameStats')
    const [draft, published] = await Promise.all([
        listAllCollectionItems(stats, 'draft'),
        listAllCollectionItems(stats, 'published'),
    ])
    return [...draft, ...published]
}

export async function validateGameRemoval(id: string) {
    const posts = content.collection('posts')
    const [stats, draftPosts, publishedPosts] = await Promise.all([
        gameStatsEntries(),
        listAllCollectionItems(posts, 'draft'),
        listAllCollectionItems(posts, 'published'),
    ])
    if (
        stats.some((item) => item.data.game === id) ||
        [...draftPosts, ...publishedPosts].some((item) => item.data.gameMentions?.includes(id))
    )
        throw createError({ status: 409, statusText: 'Game is referenced by Game Stats or Posts' })
}

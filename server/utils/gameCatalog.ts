import { and, eq, inArray, sql } from 'drizzle-orm'

function catalogLookupValues(values: ReadonlyArray<string>) {
    const unique = [...new Set(values)]
    // D1 limits each statement to 100 bound parameters.
    return unique.length <= 100
        ? unique
        : sql`(SELECT value FROM json_each(${JSON.stringify(unique)}))`
}

export function gameCatalog() {
    const { db, schema } = useDatabase('default')
    const table = schema.gameCatalog
    const selection = { id: table.id, data: table.data }

    return {
        list: () => db.select(selection).from(table),
        async listOrdered() {
            const items = await db.select(selection).from(table)
            return items.sort(
                (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.id.localeCompare(b.id),
            )
        },
        async reorder(
            expected: Array<{ id: string; order: number }>,
            changes: Array<{ id: string; order: number }>,
        ) {
            // Check the complete order and patch just the order field in the same statement.
            const result = await db.all<{ id: string }>(sql`
                WITH expected AS (
                    SELECT value ->> 'id' AS id, value ->> 'order' AS rank
                    FROM json_each(${JSON.stringify(expected)})
                ), changes AS (
                    SELECT value ->> 'id' AS id, value ->> 'order' AS rank
                    FROM json_each(${JSON.stringify(changes)})
                )
                UPDATE ${table}
                SET data = json_set(data, '$.order', (SELECT rank FROM changes WHERE changes.id = ${table.id}))
                WHERE ${table.id} IN (SELECT id FROM changes)
                    AND (SELECT count(*) FROM ${table}) = (SELECT count(*) FROM expected)
                    AND NOT EXISTS (
                        SELECT 1 FROM expected
                        LEFT JOIN ${table} AS current ON current.id = expected.id
                        WHERE current.id IS NULL
                            OR coalesce(json_extract(current.data, '$.order'), 0) <> expected.rank
                    )
                RETURNING id
            `)
            return result.length === changes.length
        },
        async get(id: string) {
            return await db.select(selection).from(table).where(eq(table.id, id)).get()
        },
        async byIgdbId(igdbId: number) {
            return await db.select(selection).from(table).where(eq(table.igdbId, igdbId)).get()
        },
        async bySlug(slug: string) {
            return await db.select(selection).from(table).where(eq(table.slug, slug)).get()
        },
        async byIds(ids: ReadonlyArray<string>) {
            if (!ids.length) return []
            return await db
                .select(selection)
                .from(table)
                .where(inArray(table.id, catalogLookupValues(ids)))
        },
        async bySlugs(slugs: ReadonlyArray<string>) {
            if (!slugs.length) return []
            return await db
                .select(selection)
                .from(table)
                .where(inArray(table.slug, catalogLookupValues(slugs)))
        },
        async existingIds(ids: ReadonlyArray<string>): Promise<Set<string>> {
            if (!ids.length) return new Set()
            const rows = await db
                .select({ id: table.id })
                .from(table)
                .where(inArray(table.id, catalogLookupValues(ids)))
            return new Set(rows.map(({ id }) => id))
        },
        async nextOrder() {
            const row = await db.get<{ nextOrder: number }>(sql`
                SELECT coalesce(max(cast(json_extract(${table.data}, '$.order') AS integer)), -1) + 1 AS nextOrder
                FROM ${table}
            `)
            return row?.nextOrder ?? 0
        },
        async insert(id: string, data: GameRecordData) {
            return await db
                .insert(table)
                .values({ id, igdbId: data.igdbId, slug: data.slug, data })
                .onConflictDoNothing({ target: table.igdbId })
                .returning(selection)
                .get()
        },
        async update(id: string, previous: GameRecordData, data: GameRecordData) {
            return await db
                .update(table)
                .set({ data })
                .where(and(eq(table.id, id), eq(table.data, previous)))
                .returning({ id: table.id })
                .get()
        },
        async remove(id: string) {
            await db.delete(table).where(eq(table.id, id))
        },
    }
}

export function gameMentionDataBySlug(
    games: ReadonlyArray<GameCatalogItem>,
): Record<string, GameMentionData> {
    return Object.fromEntries(
        games.map(({ data: { slug, name, icon, cover } }) => [slug, { slug, name, icon, cover }]),
    )
}

export function catalogGameId(igdbId: number): string {
    return `igdb-${igdbId}`
}

export async function resolveRemoteCatalogGame(
    query: { id: number } | { slug: string },
): Promise<GameSearchResult> {
    const remoteGames = await queryIgdb(query)
    const matched =
        'id' in query
            ? remoteGames.find((entry) => entry.igdbId === query.id)
            : remoteGames.find((entry) => entry.slug === query.slug)
    if (!matched) throw createError({ status: 404, statusText: 'Game not found in IGDB' })

    return matched
}

export async function insertCatalogGame(
    game: GameSearchResult,
    overrides?: {
        primaryMetric?: string
        metrics?: GameRecordData['metrics']
    },
) {
    const games = gameCatalog()
    const id = catalogGameId(game.igdbId)
    const order = await games.nextOrder()
    const parsed = gameFieldsSchema.parse({
        igdbId: game.igdbId,
        slug: game.slug,
        name: game.name,
        cover: game.cover ?? undefined,
        order,
        primaryMetric: overrides?.primaryMetric || undefined,
        metrics: overrides?.metrics ?? [],
    })
    const saved = (await games.insert(id, parsed)) ?? (await games.byIgdbId(game.igdbId))
    if (!saved)
        throw createError({ status: 409, statusText: 'The game changed. Reload and try again.' })

    return saved
}

export function hasGameConfigDiff(previous: GameRecordData, next: GameRecordData): boolean {
    return (
        (previous.primaryMetric ?? undefined) !== (next.primaryMetric ?? undefined) ||
        JSON.stringify(previous.metrics) !== JSON.stringify(next.metrics)
    )
}

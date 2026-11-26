import { and, eq, sql } from 'drizzle-orm'
import { useDatabase } from 'vite-hub/database'

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
        async insert(id: string, data: GameRecordData) {
            return await db
                .insert(table)
                .values({ id, igdbId: data.igdbId, slug: data.slug, data })
                .onConflictDoNothing({ target: table.igdbId })
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

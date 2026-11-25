import { eq } from 'drizzle-orm'
import { useDatabase } from 'vite-hub/database'

import type { GameRecordData } from '../../shared/schemas/content.js'

export function gameCatalog() {
    const { db, schema } = useDatabase('default')
    const table = schema.gameCatalog
    const selection = { id: table.id, data: table.data }

    return {
        list: () => db.select(selection).from(table),
        async get(id: string) {
            return await db.select(selection).from(table).where(eq(table.id, id)).get()
        },
        async byIgdbId(igdbId: number) {
            return await db.select(selection).from(table).where(eq(table.igdbId, igdbId)).get()
        },
        async insert(id: string, data: GameRecordData) {
            return await db
                .insert(table)
                .values({ id, igdbId: data.igdbId, slug: data.slug, data })
                .onConflictDoNothing({ target: table.id })
        },
    }
}

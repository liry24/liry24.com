import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { defineDatabase } from 'vite-hub/database'

import type { GameRecordData } from '../../shared/schemas/content.js'

const gameCatalog = sqliteTable('game_catalog', {
    id: text().primaryKey(),
    igdbId: integer('igdb_id').notNull().unique(),
    slug: text().notNull().unique(),
    data: text({ mode: 'json' }).$type<GameRecordData>().notNull(),
})

export default defineDatabase({ schema: { gameCatalog } })

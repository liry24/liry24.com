import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { GameRecordData } from '../../../shared/types/content.js'

export const gameCatalog = sqliteTable('game_catalog', {
    id: text().primaryKey(),
    igdbId: integer('igdb_id').notNull().unique(),
    slug: text().notNull().unique(),
    data: text({ mode: 'json' }).$type<GameRecordData>().notNull(),
})

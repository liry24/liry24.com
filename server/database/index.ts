import type { D1Database } from '@cloudflare/workers-types'
import { drizzle } from 'drizzle-orm/d1'

import * as schema from './schema'
const relations = schema.authRelations
const connections = new WeakMap<D1Database, ReturnType<typeof drizzle<typeof relations>>>()

const createDB = (d1: D1Database) => {
    let database = connections.get(d1)
    if (!database) {
        database = drizzle(d1, { relations })
        connections.set(d1, database)
    }
    return database
}

type Database = ReturnType<typeof createDB>

export { createDB }
export type { Database }

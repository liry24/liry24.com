import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'

import * as schema from './schema.ts'

const defaultDatabasePath = '.data/development/sqlite.db'

// Import this module only from Nitro's compile-time development branch.
// This new SQLite file never reads, imports or changes the old local D1 data.
export const openDevelopmentDB = ({
    databasePath = defaultDatabasePath,
    migrationsFolder = 'drizzle',
}: {
    databasePath?: string
    migrationsFolder?: string
} = {}) => {
    const path = databasePath === ':memory:' ? databasePath : resolve(databasePath)
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const client = new DatabaseSync(path)
    try {
        client.exec(
            'PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;',
        )
        const database = drizzle({ client, relations: schema.authRelations })
        // Startup only. HTTP requests and production/prerender never call the migrator.
        migrate(database, { migrationsFolder: resolve(migrationsFolder) })
        return { database, path, close: () => client.close() }
    } catch (error) {
        client.close()
        throw error
    }
}

export type DevelopmentDatabase = ReturnType<typeof openDevelopmentDB>['database']

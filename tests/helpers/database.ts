import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { sqliteD1 } from './d1'

const migrationsDir = 'server/databases/default/migrations'

export const baselineStatements = () =>
    readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(migrationsDir, entry.name, 'migration.sql'))
        .filter((file) => existsSync(file))
        .toSorted()
        .flatMap((file) =>
            readFileSync(file, 'utf8')
                .split('--> statement-breakpoint')
                .map((sql) => sql.trim())
                .filter(Boolean),
        )

// Runtime/Worker checks use native D1; this fixture checks the same generated SQL in isolation.
export function openTestDatabase() {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys=ON')
    for (const sql of baselineStatements()) sqlite.exec(sql)

    const env = { DB: sqliteD1(sqlite) }
    return { sqlite, env, close: () => sqlite.close() }
}

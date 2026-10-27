import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { sqliteD1 } from './d1'

export const baselineStatements = () =>
    readdirSync('server/databases/migrations')
        .filter((file) => file.endsWith('.sql'))
        .sort()
        .flatMap((file) =>
            readFileSync(join('server/databases/migrations', file), 'utf8')
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

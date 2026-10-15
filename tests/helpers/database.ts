import { DatabaseSync } from 'node:sqlite'

import type { SiteAdminDatabase } from '@liria24/site-admin/internal/adapter'
import { useVoidDatabase } from '@liria24/site-admin/internal/runtime/database'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { withRuntimeEnv } from 'void/_env'

import * as schema from '../../db/schema'
import { sqliteD1 } from './d1'

// Tests get isolated SQLite-backed D1 bindings; application runtime uses Void's binding.
export function openTestDatabase() {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys=ON')
    for (const migration of readMigrationFiles({ migrationsFolder: 'db/migrations' }))
        sqlite.exec(migration.sql.join(';'))
    const env = { DB: sqliteD1(sqlite) }
    return { sqlite, env, database: bindTestDatabase(env), close: () => sqlite.close() }
}

export function bindTestDatabase(env: { DB: unknown }): SiteAdminDatabase {
    return {
        bind(config) {
            const storage = withRuntimeEnv(env, () => useVoidDatabase(schema).bind(config))
            return new Proxy(storage, {
                get(target, property, receiver) {
                    const value = Reflect.get(target, property, receiver)
                    return typeof value === 'function'
                        ? (...args: unknown[]) =>
                              withRuntimeEnv(env, () => Reflect.apply(value, target, args))
                        : value
                },
            })
        },
    }
}

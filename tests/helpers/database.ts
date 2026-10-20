import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { useVoidDatabase } from '@litijs/void/session'
import type { LitiDatabase } from 'liti/adapter'
import { withRuntimeEnv } from 'void/_env'

import * as schema from '../../db/schema'
import { sqliteD1 } from './d1'

export const baselineStatements = () =>
    readdirSync('db/migrations')
        .filter((file) => file.endsWith('.sql'))
        .sort()
        .flatMap((file) =>
            readFileSync(join('db/migrations', file), 'utf8')
                .split('--> statement-breakpoint')
                .map((sql) => sql.trim())
                .filter(Boolean),
        )

// Tests get isolated SQLite-backed D1 bindings; application runtime uses Void's binding.
export function openTestDatabase() {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec('PRAGMA foreign_keys=ON')
    for (const sql of baselineStatements()) sqlite.exec(sql)
    const env = { DB: sqliteD1(sqlite) }
    return { sqlite, env, database: bindTestDatabase(env), close: () => sqlite.close() }
}

export function bindTestDatabase(env: { DB: unknown }): LitiDatabase {
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

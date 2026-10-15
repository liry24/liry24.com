import assert from 'node:assert/strict'

import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { drizzle } from 'drizzle-orm/d1'

import * as schema from '../server/database/schema.ts'
import config from '../site-admin.config.ts'
import { workerName } from './preview-target.mjs'

// Called only after SQL migrations against the exact branch Preview resource.
export async function rebuildPreviewSearch(database, resourceName, query) {
    assert(
        database.name === resourceName && resourceName.startsWith(workerName + '-p-'),
        'Expected an isolated Preview database',
    )
    assert(
        database.uuid !== '227d818f-cd40-4fca-9710-b57273be94ca' &&
            /^[a-f0-9-]{36}$/i.test(database.uuid),
        'Expected a D1 database ID',
    )
    class Statement {
        params = []
        constructor(sql) {
            this.sql = sql
        }
        bind(...params) {
            this.params = params
            return this
        }
        async all() {
            return (await query([{ sql: this.sql, params: this.params }]))[0]
        }
        async run() {
            return this.all()
        }
    }
    const client = {
        prepare: (sql) => new Statement(sql),
        batch: (statements) => query(statements.map(({ sql, params }) => ({ sql, params }))),
    }
    const adapter = drizzleAdapter(drizzle(client, { relations: schema.authRelations }), { schema })
    return adapter.bind(config).rebuildSearch()
}

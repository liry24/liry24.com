import type { D1Database } from '@cloudflare/workers-types'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdmin } from '@liria24/site-admin/server'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { afterEach, expect, test } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import * as schema from '../../packages/database/src/schema'

test('forward migration preserves authentication rows and foreign keys', () => {
    const db = new DatabaseSync(':memory:')
    try {
        const migrations = readMigrationFiles({ migrationsFolder: 'drizzle' })
        for (const migration of migrations.slice(0, -1)) db.exec(migration.sql.join(';'))
        db.exec(
            "INSERT INTO users(id,name,email,email_verified,created_at,updated_at) VALUES ('user','Test','local@example.test',1,1,1)",
        )
        db.exec(
            "INSERT INTO accounts(id,account_id,issuer,provider_id,user_id,created_at,updated_at) VALUES ('account','subject','https://issuer.example','github','user',1,1)",
        )
        db.exec(
            "INSERT INTO sessions(id,token,user_id,expires_at,created_at,updated_at) VALUES ('session','token','user',9999999999999,1,1)",
        )
        db.exec(
            "INSERT INTO passkeys(id,public_key,user_id,credential_id,counter,device_type,backed_up) VALUES ('passkey','key','user','credential',0,'singleDevice',0)",
        )
        const before = Object.fromEntries(
            ['users', 'accounts', 'sessions', 'passkeys'].map((table) => [
                table,
                db.prepare('SELECT * FROM ' + table).all(),
            ]),
        )
        db.exec(migrations.at(-1)!.sql.join(';'))
        for (const [table, rows] of Object.entries(before))
            expect(db.prepare('SELECT * FROM ' + table).all()).toEqual(rows)
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        expect(
            db
                .prepare('PRAGMA table_info(accounts)')
                .all()
                .find((row) => row.name === 'issuer')?.notnull,
        ).toBe(0)
    } finally {
        db.close()
    }
})

import { DatabaseSync } from 'node:sqlite'

import { readMigrationFiles } from 'drizzle-orm/migrator'

import config from '../../site-admin.config'
let proxy: Awaited<ReturnType<typeof getPlatformProxy>> | undefined
afterEach(async () => {
    await proxy?.dispose()
}, 60_000)

test('application-owned D1 uses explicit migration and preserves scheduled revisions', async () => {
    proxy = await getPlatformProxy({
        remoteBindings: false,
        configPath: 'wrangler.local.jsonc',
        persist: false,
    })
    const env = proxy.env as { DB: D1Database }
    const orm = drizzle(env.DB)
    await migrate(orm, { migrationsFolder: 'drizzle' })
    const database = drizzleAdapter(orm, { schema })
    const admin = createSiteAdmin({ config, database })
    let entry = await admin.createEntry('posts', {
        slug: 'worker-test',
        data: { title: 'A', content: '# A', tags: [] },
    })
    entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
    const revisionA = entry.publishedRevisionId
    entry = await admin.updateEntry(entry.id, {
        expectedVersion: entry.version,
        data: { title: 'B', content: '# B', tags: [] },
    })
    entry = await admin.schedulePublish(entry.id, {
        expectedVersion: entry.version,
        at: new Date(Date.now() + 3600000).toISOString(),
    })
    const revisionB = entry.scheduledRevisionId
    const oldVersion = entry.version
    entry = await admin.updateEntry(entry.id, {
        expectedVersion: entry.version,
        data: { title: 'C', content: '# C', tags: [] },
    })
    expect(entry.publishedRevisionId).toBe(revisionA)
    expect(entry.scheduledRevisionId).toBe(revisionB)
    expect(entry.currentRevisionId).not.toBe(revisionB)
    await expect(
        admin.updateEntry(entry.id, { expectedVersion: oldVersion, data: entry.data }),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_CONFLICT' })
    expect((await admin.getPublicEntry('posts', 'worker-test'))?.data.title).toBe('A')
}, 60_000)

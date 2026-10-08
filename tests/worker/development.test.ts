import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { drizzleAdapter as authAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdmin } from '@liria24/site-admin/server'
import { transform } from 'esbuild'
import { expect, test } from 'vitest'

import { betterAuth } from '#better-auth'

import { openDevelopmentDB } from '../../server/database/development'
import * as schema from '../../server/database/schema'
import config from '../../site-admin.config'

test('development SQLite migrates once and preserves shared auth/content data across reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'liry24-development-test-'))
    const databasePath = join(directory, 'development/sqlite.db')
    // A sentinel models old local D1 data without accessing or rewriting .data/unified.
    const oldData = join(directory, 'unified-sentinel')
    await writeFile(oldData, 'old-local-D1-data')
    let local = openDevelopmentDB({ databasePath })
    try {
        const migrationCount = () =>
            local.database.$client.prepare('SELECT COUNT(*) n FROM __drizzle_migrations').get()?.n
        const count = migrationCount()
        expect(Number(count)).toBeGreaterThan(0)
        const admin = createSiteAdmin({
            config,
            database: drizzleAdapter(local.database, { schema }),
        })
        const auth = betterAuth({
            baseURL: 'http://localhost:3000',
            secret: 'test-only-development-secret-0123456789abcdef',
            database: authAdapter(local.database, {
                provider: 'sqlite',
                schema,
                transaction: false,
                usePlural: true,
            }),
        })
        expect(
            await (
                await auth.handler(new Request('http://localhost:3000/api/auth/get-session'))
            ).json(),
        ).toBeNull()
        let entry = await admin.createEntry('posts', {
            slug: 'sqlite-persistence',
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
        const staleVersion = entry.version
        entry = await admin.updateEntry(entry.id, {
            expectedVersion: entry.version,
            data: { title: 'C', content: '# C', tags: [] },
        })
        await expect(
            admin.updateEntry(entry.id, {
                expectedVersion: staleVersion,
                data: entry.data,
            }),
        ).rejects.toMatchObject({ code: 'SITE_ADMIN_CONFLICT' })
        local.close()
        local = openDevelopmentDB({ databasePath })
        expect(migrationCount()).toBe(count)
        const reopened = createSiteAdmin({
            config,
            database: drizzleAdapter(local.database, { schema }),
        })
        const persisted = await reopened.getEntry(entry.id)
        expect(persisted.publishedRevisionId).toBe(revisionA)
        expect(persisted.scheduledRevisionId).toBe(revisionB)
        expect(persisted.currentRevisionId).not.toBe(revisionB)
        expect(persisted.data.title).toBe('C')
        expect((await reopened.getPublicEntry('posts', 'sqlite-persistence'))?.data.title).toBe('A')
        expect(await readFile(oldData, 'utf8')).toBe('old-local-D1-data')
    } finally {
        local.close()
        await rm(directory, { recursive: true, force: true })
    }
})

test('production and prerender transforms remove the development driver and migrator path', async () => {
    const source = await readFile('server/plugins/site-admin-database.ts', 'utf8')
    for (const dev of [false, true]) {
        const output = await transform(source, {
            loader: 'ts',
            treeShaking: true,
            minifySyntax: true,
            define: { 'import.meta.dev': String(dev), 'import.meta.prerender': String(dev) },
        })
        expect(output.code).not.toContain('database/development')
        expect(output.code).not.toContain('openDevelopmentDB')
        expect(output.code).not.toContain('LIRY24_DEV_DB_PATH')
    }
})

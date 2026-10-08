import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdmin } from '@liria24/site-admin/server'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { expect, test } from 'vitest'
import { createTestHarness, type Unstable_RawConfig } from 'wrangler'

import * as schema from '../../server/database/schema'
import siteAdminConfig from '../../site-admin.config'

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the emitted v2 Worker uses D1/R2 and wires scheduled publishing without the local SQLite driver',
    async () => {
        const root = await mkdtemp(join(tmpdir(), 'liry24-built-worker-'))
        const generated = JSON.parse(await readFile('.output/server/wrangler.json', 'utf8'))
        expect(generated.compatibility_flags).toEqual([
            'nodejs_compat_v2',
            'enable_nodejs_process_v2',
            'nodejs_compat_populate_process_env',
        ])
        const serverDirectory = resolve('.output/server')
        const chunks = await readdir(serverDirectory, { recursive: true })
        for (const file of chunks.filter((file) => file.endsWith('.mjs'))) {
            const bundle = await readFile(join(serverDirectory, file), 'utf8')
            for (const marker of [
                'openDevelopmentDB',
                'LIRY24_DEV_DB_PATH',
                '.data/development/sqlite.db',
                'drizzle-orm/node-sqlite',
                'node-sqlite/migrator',
            ])
                expect(bundle, `${file}: development code ${marker}`).not.toContain(marker)
        }
        const isPreview = Boolean(generated.previews)
        const runtime = isPreview ? generated.previews : generated
        const config: Unstable_RawConfig = {
            ...generated,
            ...runtime,
            name: 'liry24-built-worker-test',
            main: resolve('.output/server/index.mjs'),
            assets: { ...generated.assets, directory: resolve('.output/public') },
            routes: [],
            triggers: { crons: [] },
            d1_databases: [{ binding: 'DB', database_name: 'test-db', database_id: 'test-db' }],
            r2_buckets: [{ binding: 'R2', bucket_name: 'test-assets' }],
        }
        delete config.previews
        const configPath = join(root, 'wrangler.json')
        await writeFile(configPath, JSON.stringify(config))
        const secrets = Object.fromEntries(
            [...generated.secrets.required, 'PREVIEW_GITHUB_TOKEN'].map((name) => [
                name,
                `test-only-${name}-0123456789abcdef0123456789abcdef`,
            ]),
        )
        const server = createTestHarness({ workers: [{ configPath, secrets }] })
        try {
            await server.listen()
            const worker = server.getWorker<{ DB: D1Database; R2: R2Bucket }>()
            const env = await worker.getEnv()
            const orm = drizzle(env.DB)
            await migrate(orm, { migrationsFolder: 'drizzle' })
            const admin = createSiteAdmin({
                config: siteAdminConfig,
                database: drizzleAdapter(orm, { schema }),
            })
            await env.R2.put('runtime-binding-probe', 'local-only')
            expect(await (await env.R2.get('runtime-binding-probe'))?.text()).toBe('local-only')
            for (const [path, status] of [
                ['/', 200],
                ['/api/auth/get-session', 200],
                ['/api/site-admin/models', 401],
                ['/admin/works', 404],
                ['/favicon.ico', 200],
                ['/login', 200],
            ] as const) {
                const response = await server.fetch(path)
                const body = await response.text()
                expect(response.status, `${path}: ${body.slice(0, 300)}`).toBe(status)
                if (path === '/api/auth/get-session') expect(body).toBe('null')
                if (path === '/login' && isPreview) expect(body).not.toContain('Vercel')
            }
            let entry = await admin.createEntry('posts', {
                slug: 'emitted-scheduled-handler',
                data: { title: 'A', content: '# A', tags: [] },
            })
            entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
            entry = await admin.updateEntry(entry.id, {
                expectedVersion: entry.version,
                data: { title: 'B', content: '# B', tags: [] },
            })
            const at = new Date(Date.now() + 60_000)
            entry = await admin.schedulePublish(entry.id, {
                expectedVersion: entry.version,
                at: at.toISOString(),
            })
            const scheduledRevision = entry.scheduledRevisionId
            entry = await admin.updateEntry(entry.id, {
                expectedVersion: entry.version,
                data: { title: 'C', content: '# C', tags: [] },
            })
            const currentRevision = entry.currentRevisionId
            // Dispatch through the actual emitted Worker entry, not admin.publishDue().
            expect((await worker.scheduled({ scheduledTime: at, cron: '* * * * *' })).outcome).toBe(
                'ok',
            )
            await expect
                .poll(async () => (await admin.getEntry(entry.id)).publishedRevisionId)
                .toBe(scheduledRevision)
            const published = await admin.getEntry(entry.id)
            expect(published.scheduledRevisionId).toBeNull()
            expect(published.currentRevisionId).toBe(currentRevision)
            expect((await admin.getPublicEntry('posts', entry.slug))?.data.title).toBe('B')
        } finally {
            for (const log of server.getLogs().filter((log) => log.level === 'error'))
                console.error(log.message)
            await server.close()
            await rm(root, { recursive: true, force: true })
        }
    },
    60_000,
)

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { createSiteAdmin } from '@liria24/site-admin/internal/server'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { afterEach, expect, test } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import config from '../../site-admin.config'
import { bindTestDatabase } from '../helpers/database'
let proxy: Awaited<ReturnType<typeof getPlatformProxy>> | undefined
let fixtureDirectory: string | undefined
afterEach(async () => {
    try {
        await proxy?.dispose()
    } finally {
        proxy = undefined
        if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true })
        fixtureDirectory = undefined
    }
}, 60_000)

test('Void D1 uses explicit migration and preserves scheduled revisions', async () => {
    fixtureDirectory = await mkdtemp(join(tmpdir(), 'liry24-content-test-'))
    const configPath = join(fixtureDirectory, 'wrangler.json')
    await writeFile(
        configPath,
        JSON.stringify({
            name: 'liry24-content-test',
            compatibility_date: '2026-07-30',
            d1_databases: [
                {
                    binding: 'DB',
                    database_name: 'liry24-content-test',
                    database_id: '00000000-0000-0000-0000-000000000001',
                },
            ],
        }),
    )
    proxy = await getPlatformProxy({
        remoteBindings: false,
        configPath,
        persist: false,
    })
    const env = proxy.env as { DB: D1Database }
    const orm = drizzle(env.DB)
    await migrate(orm, { migrationsFolder: 'db/migrations' })
    const database = bindTestDatabase(env)
    const admin = createSiteAdmin({
        locales: { defaultLocale: 'ja', supported: ['ja'] },
        config,
        database,
    })
    let entry = await admin.createEntry('posts', {
        data: { title: 'A', content: '# A', tags: [], slug: 'worker-test' },
    })
    entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
    const revisionA = entry.publishedRevisionId
    entry = await admin.schedulePublish(entry.id, {
        expectedVersion: entry.version,
        at: new Date(Date.now() + 3600000).toISOString(),
        draft: {
            data: {
                title: 'B',
                content: '# B',
                tags: [],
                publication: { slug: 'auto', publishedSlug: 'worker-test' },
                slug: 'worker-test',
            },
        },
    })
    const revisionB = entry.scheduledRevisionId
    expect(entry.currentRevisionId).toBe(revisionB)
    expect(entry.data.publication).toMatchObject({ slug: 'auto' })
    const oldVersion = entry.version
    entry = await admin.updateEntry(entry.id, {
        expectedVersion: entry.version,
        data: { slug: entry.data.slug, title: 'C', content: '# C', tags: [] },
    })
    expect(entry.publishedRevisionId).toBe(revisionA)
    expect(entry.scheduledRevisionId).toBe(revisionB)
    expect(entry.currentRevisionId).not.toBe(revisionB)
    await expect(
        admin.updateEntry(entry.id, { expectedVersion: oldVersion, data: entry.data }),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_CONFLICT' })
    expect((await admin.getPublicEntry('posts', entry.id))?.data.title).toBe('A')
    await env.DB.prepare('DELETE FROM site_admin_search').run()
    await expect(
        admin.pageEntries({ models: ['posts'], q: 'C' }, { limit: 1, offset: 0 }),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_MIGRATION_REQUIRED' })
    expect(await admin.rebuildSearch()).toEqual({ indexed: 3 })
    expect(
        (await admin.pageEntries({ models: ['posts'], q: 'C' }, { limit: 1, offset: 0 })).total,
    ).toBe(1)
    expect(await admin.getEntry(entry.id)).toEqual(entry)
}, 60_000)

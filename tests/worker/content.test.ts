import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdmin } from '@liria24/site-admin/server'
import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { afterEach, expect, test } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import * as schema from '../../server/database/schema'
import config from '../../site-admin.config'
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

test('application-owned D1 uses explicit migration and preserves scheduled revisions', async () => {
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

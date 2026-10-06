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

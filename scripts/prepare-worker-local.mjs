import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { drizzle } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { Files } from 'files-sdk'
import { fs } from 'files-sdk/fs'
import { getPlatformProxy } from 'wrangler'

// Explicit local preparation; never run a migration from an application request.
const configPath = 'wrangler.local.jsonc'
assert(!/"remote"\s*:\s*true/.test(await readFile(configPath, 'utf8')))
const proxy = await getPlatformProxy({
    remoteBindings: false,
    configPath,
    persist: { path: resolve('.data/unified/v3') },
})
const source = new DatabaseSync('.data/site-admin.sqlite3', { readOnly: true })
try {
    const db = proxy.env.DB
    const tables = [
        'site_admin_entries',
        'site_admin_revisions',
        ...source
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'site_admin_content_%' ORDER BY name",
            )
            .all()
            .map((row) => row.name),
        'site_admin_assets',
        'site_admin_relations',
        'site_admin_asset_refs',
        'site_admin_routes',
        'site_admin_meta',
    ]
    await migrate(drizzle(db), { migrationsFolder: 'drizzle' })
    if (!process.argv.includes('--assets-only')) {
        assert(
            (await db.prepare('SELECT COUNT(*) n FROM site_admin_entries').first()).n === 0,
            'Target contains entries; never overwrite. Use --assets-only to retry Blob copy.',
        )
        const inserts = []
        for (const table of tables) {
            for (const row of source.prepare(`SELECT * FROM "${table}"`).all()) {
                const columns = Object.keys(row)
                inserts.push(
                    db
                        .prepare(
                            `INSERT ${table === 'site_admin_meta' ? 'OR REPLACE ' : ''}INTO "${table}" (${columns.map((name) => '"' + name + '"').join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
                        )
                        .bind(...Object.values(row)),
                )
            }
        }
        await db.batch(inserts)
    }
    const files = new Files({ adapter: fs({ root: resolve('.data/content-assets') }) })
    const assets = source
        .prepare("SELECT key,content_type FROM site_admin_assets WHERE state='ready'")
        .all()
    for (const asset of assets) {
        const file = await files.download(asset.key)
        assert(file, 'Missing local asset')
        await proxy.env.R2.put(asset.key, await file.arrayBuffer(), {
            httpMetadata: { contentType: asset.content_type },
        })
    }
    console.log(
        `Prepared local Worker D1 and R2: ${source.prepare('SELECT count(*) AS count FROM site_admin_entries').get().count} entries, ${assets.length} assets. No remote writes.`,
    )
} finally {
    source.close()
    await proxy.dispose()
}

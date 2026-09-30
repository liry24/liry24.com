import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdmin } from '@liria24/site-admin/server'
import { drizzle } from 'drizzle-orm/d1'
import { Files } from 'files-sdk'
import { r2 } from 'files-sdk/r2'
import { getPlatformProxy } from 'wrangler'

import * as contentSchema from '../packages/database/src/schema.ts'
import config from '../site-admin.config.ts'

// Local-only importer: production is a read-only SQL export, never a live binding.
const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const sourcePath = resolve(
    root,
    args.find((arg) => !arg.startsWith('--')) || '.data/site-admin-migration/legacy.sql',
)
const source = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false })
source.exec(await readFile(sourcePath, 'utf8'))
type Row = Record<string, string | number | null>
const rows = (table: string) => source.prepare(`SELECT * FROM "${table}"`).all() as Row[]
const modelNames = Object.keys(config.models) as Array<keyof typeof config.models>
const sourceRows = Object.fromEntries(modelNames.map((name) => [name, rows(name)]))
const counts = Object.fromEntries(modelNames.map((name) => [name, sourceRows[name]!.length]))
console.log(JSON.stringify({ mode: apply ? 'apply-local' : 'dry-run', counts }))
for (const table of ['persons', 'person_links', 'work_persons']) {
    if (rows(table).length)
        throw new Error(`${table} has data: define its destination relation before migration.`)
}
if (!apply) {
    source.close()
    process.exit(0)
}
const destination = resolve(root, '.data')
await mkdir(destination, { recursive: true })
const proxy = await getPlatformProxy({
    remoteBindings: false,
    configPath: 'wrangler.local.jsonc',
    persist: { path: resolve('.data/unified/v3') },
})
const database = drizzleAdapter(
    drizzle(proxy.env.DB as import('@cloudflare/workers-types').D1Database),
    { schema: contentSchema },
)
const ledger = new DatabaseSync(resolve(destination, 'site-admin-migration.sqlite3'))
ledger.exec(
    'CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, hash TEXT NOT NULL, version INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS assets (source TEXT PRIMARY KEY, id TEXT NOT NULL)',
)
const files = new Files({
    adapter: r2({ binding: proxy.env.R2 as import('@cloudflare/workers-types').R2Bucket }),
})
let clock = new Date()
// Existing originals can exceed the 10 MB limit for new admin uploads.
const admin = createSiteAdmin({
    config: { ...config, assets: { storage: 'content', maxUploadSize: 100_000_000 } },
    database,
    getFiles: async () => files,
    now: () => clock,
})
await admin.initialize()
const iso = (value: Row[string]) =>
    value == null ? undefined : new Date(Number(value)).toISOString()
async function asset(value: Row[string]): Promise<string | undefined> {
    if (!value) return undefined
    const url = new URL(String(value))
    if (url.origin !== 'https://images.liry24.com' || url.username || url.password)
        throw new Error('Unexpected legacy Asset origin')
    const existing = ledger.prepare('SELECT id FROM assets WHERE source = ?').get(url.href) as
        | { id: string }
        | undefined
    if (existing) {
        await admin.getAsset(existing.id)
        return existing.id
    }
    const response = await fetch(url, { redirect: 'error' })
    if (!response.ok || !response.body)
        throw new Error(`Asset download failed (${response.status})`)
    const uploaded = await admin.uploadAsset({
        body: response.body,
        filename: decodeURIComponent(url.pathname.split('/').pop() || 'asset'),
        metadata: { legacyUrl: url.href },
    })
    ledger.prepare('INSERT INTO assets (source, id) VALUES (?, ?)').run(url.href, uploaded.id)
    return uploaded.id
}
try {
    for (const name of modelNames) {
        for (const row of sourceRows[name]!) {
            const key = String(row.slug ?? row.id)
            const id = `legacy-${name}-${key}`
            const related =
                name === 'arts'
                    ? rows('art_images').filter((image) => image.art_slug === key)
                    : name === 'posts'
                      ? rows('post_tags').filter((tag) => tag.post_slug === key)
                      : []
            const hash = createHash('sha256').update(JSON.stringify({ row, related })).digest('hex')
            const completed = ledger
                .prepare('SELECT hash, version FROM entries WHERE id = ?')
                .get(id) as { hash: string; version: number } | undefined
            if (completed) {
                const entry = await admin.getEntry(id)
                if (completed.hash !== hash || entry.version !== completed.version)
                    throw new Error(`Source or destination changed after migration: ${id}`)
                continue
            }
            // Refuse to overwrite a partially imported or user-edited entry.
            try {
                await admin.getEntry(id)
                throw new Error(`Entry already exists without completed ledger: ${id}`)
            } catch (error) {
                if (
                    !(
                        error &&
                        typeof error === 'object' &&
                        'code' in error &&
                        error.code === 'SITE_ADMIN_ENTRY_NOT_FOUND'
                    )
                )
                    throw error
            }
            clock = new Date(Number(row.created_at || row.updated_at || Date.now()))
            const data: Record<string, unknown> = {}
            for (const [field, definition] of Object.entries(config.models[name].fields)) {
                const column = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
                const value = row[column]
                if (definition.kind === 'image')
                    data[field] = await asset(name === 'ranks' ? row.image_url : value)
                else if (field === 'images') {
                    const images = []
                    for (const image of related)
                        images.push({
                            id: (await asset(image.src))!,
                            ...(image.alt ? { alt: String(image.alt) } : {}),
                        })
                    data[field] = images
                } else if (field === 'tags') data[field] = related.map((tag) => String(tag.tag))
                else if (definition.kind === 'datetime') data[field] = iso(value)
                else if (
                    value !== null &&
                    value !== undefined &&
                    (value !== '' || definition.kind !== 'url')
                )
                    data[field] = value
            }
            const slug = name === 'socials' ? String(row.alias || `social-${key}`) : key
            let entry = await admin.createEntry(name, {
                id,
                slug,
                data,
                ...(row.sort_index != null ? { sortOrder: Number(row.sort_index) } : {}),
            })
            if (name !== 'posts' || row.status === 'published') {
                clock = new Date(Number(row.published_at || row.created_at || Date.now()))
                entry = await admin.publishEntry(id, { expectedVersion: entry.version })
            } else if (row.status === 'scheduled') {
                if (!row.scheduled_at) throw new Error(`Scheduled post lacks scheduled_at: ${id}`)
                clock = new Date(Math.min(Date.now(), Number(row.scheduled_at) - 1))
                entry = await admin.schedulePublish(id, {
                    expectedVersion: entry.version,
                    at: iso(row.scheduled_at)!,
                })
            } else if (row.status !== 'draft') throw new Error(`Unknown post status: ${row.status}`)
            ledger
                .prepare('INSERT INTO entries (id, hash, version) VALUES (?, ?, ?)')
                .run(id, hash, entry.version)
        }
    }
    const actual = Object.fromEntries(
        await Promise.all(
            modelNames.map(async (name) => [name, (await admin.listEntries(name)).length]),
        ),
    )
    for (const name of modelNames)
        if (actual[name] !== counts[name]) throw new Error(`Entry count mismatch: ${name}`)
    console.log(
        JSON.stringify({
            migrated: actual,
            assets: ledger.prepare('SELECT count(*) n FROM assets').get(),
            routes: (await admin.routeSnapshot()).length,
        }),
    )
} finally {
    source.close()
    ledger.close()
    await proxy.dispose()
}

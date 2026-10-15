import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { expect, test } from 'vitest'
import { getPlatformProxy } from 'wrangler'

const folder = 'drizzle/20261015065248_model_fields'
type Store = {
    exec: (sql: string) => unknown | Promise<unknown>
    all: (sql: string) => unknown[] | Promise<unknown[]>
}
async function verify(store: Store) {
    for (const path of [
        'drizzle/20261001123048_baseline/migration.sql',
        'drizzle/20261009063435_wide_shadow_king/migration.sql',
    ])
        for (const sql of readFileSync(path, 'utf8').split('--> statement-breakpoint'))
            if (sql.trim()) await store.exec(sql)
    await store.exec(
        "INSERT INTO site_admin_assets (id,storage,key,content_type,size,state,created_at,updated_at) VALUES ('asset','content','image','image/png',1,'ready','2026','2026')",
    )
    for (const model of ['posts', 'socials', 'ranks']) {
        await store.exec(
            `INSERT INTO site_admin_entries (id,model,translation_group,current_revision_id,published_revision_id,scheduled_revision_id,scheduled_at,published_at,created_at,updated_at) VALUES ('${model}','${model}','${model}','${model}-current','${model}-public','${model}-scheduled','2099-01-01','2026','2026','2026')`,
        )
        for (const state of ['current', 'public', 'scheduled', 'old']) {
            const id = model + '-' + state
            const slug = state === 'current' && model === 'posts' ? '?site-admin-draft:posts' : id
            await store.exec(
                `INSERT INTO site_admin_revisions (id,entry_id,slug,created_at) VALUES ('${id}','${model}','${slug}','2026')`,
            )
            const columns =
                model === 'posts'
                    ? 'field_title,field_content,field_tags'
                    : model === 'socials'
                      ? 'field_href,field_icon,field_label'
                      : 'field_game,field_rank,field_image'
            const values =
                model === 'posts'
                    ? "'Title','Body','[]'"
                    : model === 'socials'
                      ? "'https://example.com','icon','Label'"
                      : "'Game','Rank','asset'"
            await store.exec(
                `INSERT INTO site_admin_content_${model} (revision_id,${columns}) VALUES ('${id}',${values})`,
            )
            await store.exec(
                `INSERT INTO site_admin_asset_refs (revision_id,field_path,asset_id,position) VALUES ('${id}','image','asset',0)`,
            )
        }
        await store.exec(
            `INSERT INTO site_admin_routes (path,entry_id,revision_id,locale,kind,created_at) VALUES ('/${model}-public','${model}','${model}-public','','page','2026')`,
        )
        await store.exec(
            `INSERT INTO site_admin_routes (path,entry_id,revision_id,locale,kind,target_path,status,created_at) VALUES ('/${model}-alias','${model}','${model}-old','','historical','/${model}-public',301,'2026')`,
        )
    }
    await store.exec(
        "INSERT INTO site_admin_meta (key,value) VALUES ('content_search:v1:old','stale')",
    )
    for (const sql of readFileSync(folder + '/migration.sql', 'utf8').split(
        '--> statement-breakpoint',
    ))
        if (sql.trim()) await store.exec(sql)
    expect(await store.all('PRAGMA foreign_key_check')).toEqual([])
    expect(
        ((await store.all('PRAGMA table_info(site_admin_revisions)')) as { name: string }[]).some(
            (c) => c.name === 'slug',
        ),
    ).toBe(false)
    expect(
        await store.all('SELECT field_slug FROM site_admin_content_posts ORDER BY revision_id'),
    ).toEqual([
        { field_slug: '' },
        { field_slug: 'posts-old' },
        { field_slug: 'posts-public' },
        { field_slug: 'posts-scheduled' },
    ])
    for (const model of ['socials', 'ranks']) {
        expect(
            await store.all(
                `SELECT current_revision_id,published_revision_id,scheduled_revision_id FROM site_admin_entries WHERE id='${model}'`,
            ),
        ).toEqual([
            {
                current_revision_id: model + '-current',
                published_revision_id: model + '-public',
                scheduled_revision_id: null,
            },
        ])
        expect(
            await store.all(
                `SELECT id FROM site_admin_revisions WHERE entry_id='${model}' ORDER BY id`,
            ),
        ).toEqual([{ id: model + '-current' }, { id: model + '-public' }])
    }
    expect(await store.all('SELECT COUNT(*) AS n FROM site_admin_asset_refs')).toEqual([{ n: 8 }])
    expect(await store.all('SELECT COUNT(*) AS n FROM site_admin_routes')).toEqual([{ n: 6 }])
    expect(
        await store.all("SELECT key FROM site_admin_meta WHERE key LIKE 'content_search:v1:%'"),
    ).toEqual([])
}
test('migrates every snapshot on SQLite without publishing pending edits', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys=ON')
    try {
        await verify({ exec: (sql) => db.exec(sql), all: (sql) => db.prepare(sql).all() })
    } finally {
        db.close()
    }
})
test('migrates the same synthetic snapshots on native D1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'liry24-model-migration-'))
    const configPath = join(dir, 'wrangler.json')
    writeFileSync(
        configPath,
        JSON.stringify({
            name: 'model-migration-test',
            compatibility_date: '2026-10-15',
            d1_databases: [
                {
                    binding: 'DB',
                    database_name: 'test',
                    database_id: '00000000-0000-0000-0000-000000000001',
                },
            ],
        }),
    )
    const proxy = await getPlatformProxy({ configPath, remoteBindings: false, persist: false })
    const db = proxy.env.DB as import('@cloudflare/workers-types').D1Database
    try {
        await verify({
            exec: (sql) => db.prepare(sql).run(),
            all: async (sql) => (await db.prepare(sql).all()).results,
        })
    } finally {
        await proxy.dispose()
        rmSync(dir, { recursive: true, force: true })
    }
}, 60_000)

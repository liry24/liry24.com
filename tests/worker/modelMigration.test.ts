import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { expect, test } from 'vitest'
import { getPlatformProxy } from 'wrangler'

const folder = 'drizzle/20261015065248_model_fields'
type Store = {
    exec: (sql: string) => unknown | Promise<unknown>
    all: (sql: string) => unknown[] | Promise<unknown[]>
    batch: (sql: string[]) => unknown | Promise<unknown>
}
async function verify(store: Store, target: Store) {
    for (const path of [
        'drizzle/20261001123048_baseline/migration.sql',
        'drizzle/20261009063435_wide_shadow_king/migration.sql',
    ])
        for (const sql of readFileSync(path, 'utf8').split('--> statement-breakpoint'))
            if (sql.trim()) await store.exec(sql)
    await store.exec(
        "INSERT INTO users(id,name,email,email_verified,role,created_at,updated_at) VALUES ('user','User','fixture@example.invalid',1,'admin',1700000000123,1700000000456)",
    )
    await store.exec(
        "INSERT INTO sessions(id,token,user_id,expires_at,created_at,updated_at) VALUES ('session','token','user',2000000000123,1700000000123,1700000000456)",
    )
    await store.exec(
        "INSERT INTO accounts(id,account_id,provider_id,user_id,created_at,updated_at) VALUES ('account','42','github','user',1700000000123,1700000000456)",
    )
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
    const before = await store.all(
        'SELECT id,model,current_revision_id,published_revision_id,scheduled_revision_id FROM site_admin_entries ORDER BY id',
    )
    await store.exec(
        "INSERT INTO site_admin_meta(key,value) VALUES ('public_generation','17'),('asset_sync_lease','retained'),('content_search:v1:obsolete','obsolete')",
    )
    for (const sql of readFileSync('drizzle/20261015113136_i18n/migration.sql', 'utf8').split(
        '--> statement-breakpoint',
    ))
        if (sql.trim()) await store.exec(sql)
    expect(
        await store.all(
            'SELECT id,model,current_revision_id,published_revision_id,scheduled_revision_id FROM site_admin_entries ORDER BY id',
        ),
    ).toEqual(before)
    expect(await store.all('SELECT DISTINCT default_locale FROM site_admin_entries')).toEqual([
        { default_locale: 'ja' },
    ])
    expect(await store.all('SELECT DISTINCT locale FROM site_admin_asset_refs')).toEqual([
        { locale: 'ja' },
    ])
    expect(await store.all('SELECT * FROM site_admin_translations')).toEqual([])
    expect(await store.all('SELECT * FROM site_admin_search')).toEqual([])
    expect(
        await store.all("SELECT value FROM site_admin_meta WHERE key='public_generation'"),
    ).toEqual([{ value: '18' }])
    expect(
        await store.all("SELECT value FROM site_admin_meta WHERE key='asset_sync_lease'"),
    ).toEqual([{ value: 'retained' }])
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
    const migrations = readdirSync('db/migrations')
        .filter((name) => name.endsWith('.sql'))
        .sort()
    for (const name of migrations)
        for (const sql of readFileSync(join('db/migrations', name), 'utf8').split(
            '--> statement-breakpoint',
        ))
            if (sql.trim()) await target.exec(sql)
    const tables = (await target.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    )) as { name: string }[]
    const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
    const literal = (value: unknown) =>
        value === null
            ? 'NULL'
            : typeof value === 'number'
              ? String(value)
              : "'" + String(value).replaceAll("'", "''") + "'"
    const statements = ['PRAGMA defer_foreign_keys=ON']
    const expected = new Map<string, Record<string, unknown>[]>()
    for (const { name } of tables) {
        const rows = (await store.all(
            'SELECT * FROM ' + quote(name) + ' ORDER BY rowid',
        )) as Record<string, unknown>[]
        expected.set(name, rows)
        for (const row of rows)
            statements.push(
                'INSERT INTO ' +
                    quote(name) +
                    '(' +
                    Object.keys(row).map(quote).join(',') +
                    ') VALUES (' +
                    Object.values(row).map(literal).join(',') +
                    ')',
            )
    }
    await target.batch(statements)
    for (const { name } of tables)
        expect(await target.all('SELECT * FROM ' + quote(name) + ' ORDER BY rowid')).toEqual(
            expected.get(name),
        )
    expect(await target.all('PRAGMA foreign_key_check')).toEqual([])
    for (const ledger of ['_void_migrations', 'd1_migrations']) {
        await target.exec(
            'CREATE TABLE ' + ledger + ' (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
        )
        for (const name of migrations)
            await target.exec(
                'INSERT INTO ' + ledger + ' VALUES (' + literal(name) + ", '2026-10-16')",
            )
        expect(await target.all('SELECT name FROM ' + ledger + ' ORDER BY name')).toEqual(
            migrations.map((name) => ({ name })),
        )
    }
}
test('migrates every snapshot on SQLite without publishing pending edits', async () => {
    const db = new DatabaseSync(':memory:')
    const next = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys=ON')
    try {
        const store = (db: DatabaseSync): Store => ({
            exec: (sql) => db.exec(sql),
            all: (sql) => db.prepare(sql).all(),
            batch: (statements) => {
                db.exec('BEGIN')
                try {
                    for (const sql of statements) db.exec(sql)
                    db.exec('COMMIT')
                } catch (error) {
                    db.exec('ROLLBACK')
                    throw error
                }
            },
        })
        await verify(store(db), store(next))
    } finally {
        db.close()
        next.close()
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
                {
                    binding: 'NEXT_DB',
                    database_name: 'next',
                    database_id: '00000000-0000-0000-0000-000000000002',
                },
            ],
        }),
    )
    const proxy = await getPlatformProxy({ configPath, remoteBindings: false, persist: false })
    const db = proxy.env.DB as import('@cloudflare/workers-types').D1Database
    const next = proxy.env.NEXT_DB as typeof db
    try {
        const store = (db: typeof next): Store => ({
            exec: (sql) => db.prepare(sql).run(),
            all: async (sql) => (await db.prepare(sql).all()).results,
            batch: (statements) => db.batch(statements.map((sql) => db.prepare(sql))),
        })
        await verify(store(db), store(next))
    } finally {
        await proxy.dispose()
        rmSync(dir, { recursive: true, force: true })
    }
}, 60_000)

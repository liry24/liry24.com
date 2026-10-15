import { execFile } from 'node:child_process'
import { mkdtemp, cp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'

import { createSiteAdmin } from '@liria24/site-admin/internal/server'
import { expect, test } from 'vitest'

import config from '../../site-admin.config'
import { sqliteD1 } from '../helpers/d1'
import { bindTestDatabase } from '../helpers/database'

const run = promisify(execFile)
test('Void migrations preserve local content, authentication and ledger across restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'liry24-void-development-'))
    let sqlite: DatabaseSync | undefined
    try {
        await symlink(
            resolve('node_modules'),
            join(root, 'node_modules'),
            process.platform === 'win32' ? 'junction' : 'dir',
        )
        await writeFile(
            join(root, 'package.json'),
            JSON.stringify({
                name: 'liry24-development-test',
                type: 'module',
                dependencies: { nuxt: '*' },
            }),
        )
        await writeFile(join(root, 'nuxt.config.ts'), 'export default {}')
        await writeFile(
            join(root, 'void.config.ts'),
            'export default { inference: { bindings: { db: true } } }',
        )
        await cp('db', join(root, 'db'), { recursive: true })
        await mkdir(join(root, '.data/unified'), { recursive: true })
        await writeFile(join(root, '.data/unified/sentinel'), 'old-data')
        const migrate = () =>
            run(
                process.execPath,
                [resolve('node_modules/void/dist/cli/cli.mjs'), 'db', 'migrate'],
                { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, '.config') } },
            )
        await migrate()
        const paths = []
        for (const base of ['.wrangler', '.void'])
            for (const path of await readdir(join(root, base), { recursive: true }).catch(() => []))
                if (path.endsWith('.sqlite')) paths.push(join(root, base, path))
        expect(paths).toHaveLength(1)
        const path = paths[0]!
        sqlite = new DatabaseSync(path)
        const history = sqlite.prepare('SELECT name FROM _void_migrations ORDER BY name').all()
        const now = Date.now()
        sqlite
            .prepare(
                'INSERT INTO users(id,name,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            )
            .run('admin', 'Admin', 'admin@example.invalid', 1, 'admin', now, now)
        sqlite
            .prepare(
                'INSERT INTO sessions(id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
            )
            .run('session', 'token', 'admin', now + 3600000, now, now)
        const create = (database: DatabaseSync) =>
            createSiteAdmin({
                config,
                locales: { defaultLocale: 'ja', supported: ['ja'] },
                database: bindTestDatabase({ DB: sqliteD1(database) }),
            })
        const admin = create(sqlite)
        let entry = await admin.createEntry('posts', {
            data: { title: 'A', content: '# A', tags: [], slug: 'persistent' },
        })
        entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
        const published = entry.publishedRevisionId
        entry = await admin.schedulePublish(entry.id, {
            expectedVersion: entry.version,
            at: new Date(now + 3600000).toISOString(),
            draft: { data: { ...entry.data, title: 'B' } },
        })
        const scheduled = entry.scheduledRevisionId
        entry = await admin.updateEntry(entry.id, {
            expectedVersion: entry.version,
            data: { ...entry.data, title: 'C' },
        })
        sqlite.close()
        sqlite = undefined
        await migrate()
        sqlite = new DatabaseSync(path)
        expect(sqlite.prepare('SELECT name FROM _void_migrations ORDER BY name').all()).toEqual(
            history,
        )
        const reopened = create(sqlite)
        expect(await reopened.getEntry(entry.id)).toMatchObject({
            publishedRevisionId: published,
            scheduledRevisionId: scheduled,
            data: { title: 'C' },
        })
        expect((await reopened.getPublicEntry('posts', entry.id))?.data.title).toBe('A')
        expect(sqlite.prepare('SELECT token,expires_at FROM sessions').all()).toEqual([
            { token: 'token', expires_at: now + 3600000 },
        ])
        expect(await readFile(join(root, '.data/unified/sentinel'), 'utf8')).toBe('old-data')
    } finally {
        sqlite?.close()
        await rm(root, { force: true, recursive: true })
    }
}, 60_000)

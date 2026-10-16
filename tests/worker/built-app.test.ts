import { createHmac } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { createSiteAdmin } from '@liria24/site-admin/internal/server'
import { expect, test } from 'vitest'
import { createTestHarness, type Unstable_RawConfig } from 'wrangler'

import siteAdminConfig from '../../site-admin.config'
import { baselineStatements, bindTestDatabase } from '../helpers/database'

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the emitted v2 Worker uses D1/R2 and wires scheduled publishing without the local SQLite driver',
    async () => {
        const root = await mkdtemp(join(tmpdir(), 'liry24-built-worker-'))
        const generated = JSON.parse(await readFile('.void-wrangler.jsonc', 'utf8'))
        expect(generated.compatibility_flags).toEqual([
            'nodejs_compat_v2',
            'nodejs_als',
            'enable_nodejs_process_v2',
            'nodejs_compat_populate_process_env',
        ])
        expect(generated.ai?.binding).toBe('AI')
        const serverDirectory = resolve('.output/server')
        const chunks = await readdir(serverDirectory, { recursive: true })
        const ogImageBundle = await readFile(
            join(serverDirectory, 'chunks/routes/_og/d/image.mjs'),
            'utf8',
        )
        for (const family of ['Special Gothic Expanded One', 'Geist Mono'])
            expect(ogImageBundle, `OG images retain ${family}`).toMatch(
                new RegExp(`(?:\\bfamily|"family"):\\s*"${family}"`),
            )
        const homeComponentPath = chunks.find((file) =>
            /[/\\]build[/\\]Home\.takumi-[^/\\]+\.mjs$/.test(file),
        )
        expect(homeComponentPath, 'OG home component is emitted').toBeDefined()
        const homeComponent = await readFile(join(serverDirectory, homeComponentPath!), 'utf8')
        expect(homeComponent).toMatch(/"font-family":\s*"'Special Gothic Expanded One'"/)
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
        const isPreview = generated.vars?.APP_ENV === 'dev'
        const runtime = generated
        const config: Unstable_RawConfig = {
            ...generated,
            ...runtime,
            name: 'liry24-built-worker-test',
            main: resolve('.output/server/index.mjs'),
            assets: { binding: 'ASSETS', directory: resolve('.output/public') },
            routes: [],
            triggers: { crons: [] },
            d1_databases: [
                {
                    binding: 'DB',
                    database_name: 'test-db',
                    database_id: '00000000-0000-4000-8000-000000000001',
                },
            ],
            r2_buckets: [{ binding: 'STORAGE', bucket_name: 'test-assets' }],
        }
        delete config.previews
        // No inference or remote AI service is available in this synthetic Worker test.
        delete config.ai
        const configPath = join(root, 'wrangler.json')
        await writeFile(configPath, JSON.stringify(config))
        const secrets = Object.fromEntries(
            [
                ...(generated.secrets?.required ?? [
                    'BETTER_AUTH_SECRET',
                    'NUXT_APP_SECRET',
                    'GITHUB_CLIENT_ID',
                    'GITHUB_CLIENT_SECRET',
                ]),
                'PREVIEW_GITHUB_TOKEN',
            ].map((name) => [name, `test-only-${name}-0123456789abcdef0123456789abcdef`]),
        )
        // Exercise Void's actual deploy rebundling, including the native OG renderer WASM.
        const { n: prepare } = await import(
            pathToFileURL(resolve('node_modules/void/dist/cf-build-output-Bc8i3dzE.mjs')).href
        )
        const prepared = await prepare({
            projectRoot: process.cwd(),
            configPath,
            accountId: generated.account_id,
        })
        expect(prepared).not.toBeNull()
        const workerOutput = join(prepared.directory, '.cloudflare/output/v0/workers/default')
        const built = JSON.parse(await readFile(join(workerOutput, 'worker.config.json'), 'utf8'))
        expect(Object.values(built.manifest.modules)).toContainEqual({ type: 'wasm' })
        config.main = join(workerOutput, 'bundle', built.manifest.mainModule)
        await writeFile(configPath, JSON.stringify(config))
        const server = createTestHarness({ workers: [{ configPath, secrets }] })
        try {
            await server.listen()
            const worker = server.getWorker<{ DB: D1Database; STORAGE: R2Bucket }>()
            const env = await worker.getEnv()
            await env.DB.batch(baselineStatements().map((sql) => env.DB.prepare(sql)))
            const preparedAt = Date.now() - 120_000
            const admin = createSiteAdmin({
                now: () => new Date(preparedAt),
                locales: { defaultLocale: 'ja', supported: ['ja'] },
                config: siteAdminConfig,
                database: bindTestDatabase(env),
            })
            await env.STORAGE.put('runtime-binding-probe', 'local-only')
            expect(await (await env.STORAGE.get('runtime-binding-probe'))?.text()).toBe(
                'local-only',
            )
            for (const [path, status] of [
                ['/api/auth/get-session', 200],
                ['/', 200],
                ['/works', 200],
                ['/api/site-admin/models', 401],
                ['/admin/works', 302],
                ['/favicon.ico', 200],
                ['/login', 200],
            ] as const) {
                const response = await server.fetch(path, { redirect: 'manual' })
                const body = await response.text()
                expect(response.status, `${path}: ${body.slice(0, 300)}`).toBe(status)
                if (path === '/' || path === '/works') {
                    const image = body.match(
                        /<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/,
                    )
                    expect(image, 'SSR includes an OG image').not.toBeNull()
                    const url = new URL(image![1]!.replaceAll('&amp;', '&'))
                    const rendered = await server.fetch(`${url.pathname}${url.search}`)
                    expect(rendered.status, await rendered.clone().text()).toBe(200)
                    expect(rendered.headers.get('content-type')).toMatch(/^image\//)
                    expect((await rendered.arrayBuffer()).byteLength).toBeGreaterThan(1000)
                }
                if (path === '/api/auth/get-session') expect(body).toBe('null')
                if (path === '/login' && isPreview) expect(body).not.toContain('Vercel')
            }
            const composeRequest = (headers: Record<string, string> = {}) =>
                server.fetch('/api/admin/compose', {
                    method: 'POST',
                    headers: { ...headers, 'content-type': 'application/json' },
                    body: JSON.stringify({
                        prompt: 'new post',
                        locale: 'ja',
                        timeZone: 'Asia/Tokyo',
                    }),
                })
            const compose = await composeRequest()
            expect(compose.status, await compose.text()).toBe(401)
            const userId = 'synthetic-built-worker-admin'
            const token = 'synthetic-built-worker-session'
            const now = Date.now()
            await env.DB.prepare(
                'INSERT INTO users (id,name,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            )
                .bind(
                    userId,
                    'Synthetic admin',
                    'built-admin@example.invalid',
                    1,
                    'admin',
                    now,
                    now,
                )
                .run()
            await env.DB.prepare(
                'INSERT INTO sessions (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
            )
                .bind('synthetic-built-worker-session', token, userId, now + 3600000, now, now)
                .run()
            const signed = encodeURIComponent(
                `${token}.${createHmac('sha256', secrets.BETTER_AUTH_SECRET!)
                    .update(token)
                    .digest('base64')}`,
            )
            const authenticated = {
                cookie: `better-auth.session_token=${signed}; __Secure-better-auth.session_token=${signed}`,
            }
            await env.DB.prepare("UPDATE users SET role = 'user' WHERE id = ?").bind(userId).run()
            const nonAdmin = await composeRequest(authenticated)
            expect(nonAdmin.status, await nonAdmin.text()).toBe(403)
            await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(userId).run()
            const session = await server.fetch('/api/auth/get-session', { headers: authenticated })
            expect(await session.json()).toMatchObject({ user: { id: userId } })
            const models = await server.fetch('/api/site-admin/models', { headers: authenticated })
            // Login already checked GitHub; this session needs no linked account or lookup.
            expect(models.status).toBe(200)
            expect(Object.keys((await models.json<{ models: object }>()).models)).toHaveLength(7)
            const invalidCompose = await server.fetch('/api/admin/compose', {
                method: 'POST',
                headers: { ...authenticated, 'content-type': 'application/json' },
                body: JSON.stringify({ prompt: '' }),
            })
            expect(invalidCompose.status, await invalidCompose.text()).toBe(400)
            await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
                .bind(now - 1, userId)
                .run()
            const expired = await composeRequest(authenticated)
            expect(expired.status, await expired.text()).toBe(401)
            let entry = await admin.createEntry('posts', {
                data: { title: 'A', content: '# A', tags: [], slug: 'emitted-scheduled-handler' },
            })
            entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
            entry = await admin.updateEntry(entry.id, {
                expectedVersion: entry.version,
                data: { slug: entry.data.slug, title: 'B', content: '# B', tags: [] },
            })
            const at = new Date(preparedAt + 60_000)
            entry = await admin.schedulePublish(entry.id, {
                expectedVersion: entry.version,
                at: at.toISOString(),
            })
            const scheduledRevision = entry.scheduledRevisionId
            entry = await admin.updateEntry(entry.id, {
                expectedVersion: entry.version,
                data: { slug: entry.data.slug, title: 'C', content: '# C', tags: [] },
            })
            const currentRevision = entry.currentRevisionId
            // Dispatch through the actual emitted Worker entry, not admin.publishDue().
            expect((await worker.scheduled({ scheduledTime: at, cron: '* * * * *' })).outcome).toBe(
                'ok',
            )
            await expect
                .poll(async () => (await admin.getEntry(entry.id)).publishedRevisionId)
                .toBe(isPreview ? entry.publishedRevisionId : scheduledRevision)
            const published = await admin.getEntry(entry.id)
            expect(published.scheduledRevisionId).toBe(isPreview ? scheduledRevision : null)
            expect(published.currentRevisionId).toBe(currentRevision)
            expect((await admin.getPublicEntry('posts', entry.id))?.data.title).toBe(
                isPreview ? 'A' : 'B',
            )
        } finally {
            for (const log of server.getLogs().filter((log) => log.level === 'error'))
                console.error(log.message)
            await server.close()
            await prepared.dispose()
            await rm(root, { recursive: true, force: true })
        }
    },
    60_000,
)

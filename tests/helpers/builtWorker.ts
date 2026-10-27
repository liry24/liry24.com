import { createHmac } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname, basename } from 'node:path'

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { createTestHarness, type Unstable_RawConfig } from 'wrangler'

import { baselineStatements } from './database'

export async function builtWorker() {
    const temporaryRoot = resolve(tmpdir())
    const directory = await mkdtemp(resolve(temporaryRoot, 'liry24-native-worker-'))
    const generatedPath = resolve('.output/server/wrangler.json')
    const generated = JSON.parse(await readFile(generatedPath, 'utf8')) as Unstable_RawConfig
    const config: Unstable_RawConfig = {
        ...generated,
        name: 'liry24-native-worker-test',
        main: resolve(dirname(generatedPath), generated.main!),
        assets: { binding: 'ASSETS', directory: resolve('.output/public') },
        vars: {
            ...generated.vars,
            APP_ENV: 'test',
            NUXT_PUBLIC_PREVIEW: 'false',
            NUXT_PUBLIC_SITE_URL: '',
        },
        routes: [],
        triggers: { crons: [] },
        d1_databases: [
            {
                binding: 'DB',
                database_name: 'synthetic-test',
                database_id: '00000000-0000-4000-8000-000000000099',
            },
        ],
        r2_buckets: [
            { binding: 'MEDIA', bucket_name: 'synthetic-media' },
            { binding: 'CONTENT', bucket_name: 'synthetic-private-content' },
        ],
    }
    delete config.ai
    const secrets = {
        BETTER_AUTH_SECRET: 'synthetic-worker-auth-secret-0123456789abcdef',
        NUXT_APP_SECRET: 'synthetic-worker-app-secret-0123456789abcdef',
    }
    const configPath = resolve(directory, 'wrangler.json')
    await writeFile(configPath, JSON.stringify(config))
    const server = createTestHarness({ workers: [{ configPath, secrets }] })
    try {
        const { url } = await server.listen()
        const worker = server.getWorker<{ DB: D1Database; MEDIA: R2Bucket; CONTENT: R2Bucket }>()
        const env = await worker.getEnv()
        await env.DB.batch(baselineStatements().map((statement) => env.DB.prepare(statement)))
        async function session(id: string, role: 'admin' | 'user' = 'admin') {
            const now = Date.now(),
                token = `synthetic-${id}`
            await env.DB.prepare(
                'INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
            )
                .bind(id, id, `${id}@example.invalid`, role, now, now)
                .run()
            await env.DB.prepare(
                'INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            )
                .bind(id, token, id, now + 3600000, now, now)
                .run()
            const signed = encodeURIComponent(
                `${token}.${createHmac('sha256', secrets.BETTER_AUTH_SECRET).update(token).digest('base64')}`,
            )
            return {
                cookie: `better-auth.session_token=${signed}; __Secure-better-auth.session_token=${signed}`,
                origin: url.origin,
            }
        }
        return {
            server,
            worker,
            env,
            url,
            session,
            secrets,
            close: async () => {
                await server.close()
                if (
                    dirname(directory) !== temporaryRoot ||
                    !basename(directory).startsWith('liry24-native-worker-')
                )
                    throw new Error('Unexpected test directory')
                await rm(directory, { recursive: true, force: true })
            },
        }
    } catch (error) {
        await server.close()
        throw error
    }
}

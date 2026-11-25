import { createHmac } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { createTestHarness } from 'wrangler'
import type { Unstable_RawConfig } from 'wrangler'

import { baselineStatements } from './database'

export interface BuiltWorkerOptions {
    env?: Record<string, string>
    secrets?: Record<string, string>
}

function parseGeneratedWrangler(raw: string): Unstable_RawConfig {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Generated wrangler config must be a JSON object')
    }
    return parsed
}

export async function builtWorker(options: BuiltWorkerOptions = {}) {
    const temporaryRoot = resolve(tmpdir())
    const directory = await mkdtemp(resolve(temporaryRoot, 'liry24-native-worker-'))
    const generatedPath = resolve('.output/server/wrangler.json')
    const generated = parseGeneratedWrangler(await readFile(generatedPath, 'utf8'))
    if (!generated.main) {
        throw new Error('Generated wrangler config is missing main entry')
    }
    const config: Unstable_RawConfig = {
        ...generated,
        name: 'liry24-native-worker-test',
        main: resolve(dirname(generatedPath), generated.main),
        assets: { binding: 'ASSETS', directory: resolve('.output/public') },
        vars: {
            ...generated.vars,
            APP_ENV: 'test',
            LIRY24_TEST_LOCAL: 'true',
            NUXT_PUBLIC_PREVIEW: 'false',
            NUXT_PUBLIC_SITE_URL: '',
            ...options.env,
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
        r2_buckets: [{ binding: 'STORAGE', bucket_name: 'synthetic-storage' }],
    }
    delete config.ai
    delete config.previews
    const secrets = {
        BETTER_AUTH_SECRET: 'synthetic-worker-auth-secret-0123456789abcdef',
        POCKET_ID_CLIENT_ID: 'synthetic-pocket-client',
        POCKET_ID_CLIENT_SECRET: 'synthetic-pocket-secret',
        POCKET_ID_ISSUER: 'https://sso.liry24.com',
        POCKET_ID_ADMIN_EMAIL: 'owner@example.invalid',
        POCKET_ID_ADMIN_SUB: '',
        IGDB_CLIENT_ID: 'synthetic-igdb-client',
        IGDB_CLIENT_SECRET: 'synthetic-igdb-secret',
        GOOGLE_GENERATIVE_AI_API_KEY: 'synthetic-google-key',
        NUXT_APP_SECRET: 'synthetic-nuxt-app-secret-0123456789abcdef',
    }
    if (options.secrets) {
        Object.assign(secrets, options.secrets)
    }
    const configPath = resolve(directory, 'wrangler.json')
    await writeFile(configPath, JSON.stringify(config))
    const server = createTestHarness({ workers: [{ configPath, secrets }] })
    try {
        const { url } = await server.listen()
        const worker = server.getWorker<{ DB: D1Database; STORAGE: R2Bucket }>()
        const env = await worker.getEnv()
        await env.DB.batch(baselineStatements().map((statement) => env.DB.prepare(statement)))
        async function session(
            id: string,
            role: 'admin' | 'user' = 'admin',
            email = `${id}@example.invalid`,
        ) {
            const now = Date.now()
            const token = `synthetic-${id}`
            await env.DB.prepare(
                'INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
            )
                .bind(id, id, email, role, now, now)
                .run()
            await env.DB.prepare(
                'INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            )
                .bind(id, token, id, now + 3_600_000, now, now)
                .run()
            const secret = secrets.BETTER_AUTH_SECRET ?? ''
            const signed = encodeURIComponent(
                `${token}.${createHmac('sha256', secret).update(token).digest('base64')}`,
            )
            return {
                cookie: `liry24-pocket.session_token=${signed}; __Secure-liry24-pocket.session_token=${signed}`,
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
                ) {
                    throw new Error('Unexpected test directory')
                }
                await rm(directory, { recursive: true, force: true })
            },
        }
    } catch (error) {
        await server.close()
        throw error
    }
}

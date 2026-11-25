import { expect, test, vi } from 'vitest'

import { serverEnv } from '../../env'
import nuxtConfig from '../../nuxt.config'

interface EnvModuleShape {
    server?: object
    public?: object
}

interface ViteHubOptionsShape {
    host?: string
    name?: string
    publicUrl?: string
    auth?: boolean
    console?: boolean
    env?: EnvModuleShape
    database?: object
    blob?: object
    schedule?: object
    observability?: object
    agent?: object
}

function isViteHubOptions(value: unknown): value is ViteHubOptionsShape {
    return (
        typeof value === 'object' && value !== null && !Array.isArray(value) && 'database' in value
    )
}

function getViteHubOptions(config: { modules?: Array<unknown> }): ViteHubOptionsShape {
    for (const entry of config.modules ?? []) {
        if (Array.isArray(entry) && entry.length >= 2 && isViteHubOptions(entry[1])) {
            return entry[1]
        }
    }
    throw new Error('ViteHub module options were not found in nuxt.config.ts')
}

test('ViteHub configuration defines isolated preview resources, single public R2 bucket, and cron schedule', async () => {
    expect(nuxtConfig.nitro?.preset).toBeUndefined()
    try {
        for (const key of [
            'LIRY24_HOST',
            'LIRY24_WORKER_NAME',
            'LIRY24_DATABASE_NAME',
            'LIRY24_DATABASE_ID',
            'LIRY24_PREVIEW_DATABASE_ID',
            'LIRY24_STORAGE_BUCKET',
            'LIRY24_DISABLE_CRON',
            'NUXT_PUBLIC_SITE_URL',
            'WORKERS_CI_BRANCH',
        ]) {
            vi.stubEnv(key, '')
        }
        vi.stubEnv('APP_ENV', 'production')
        vi.resetModules()
        const { default: config } = await import('../../nuxt.config')
        const viteHub = getViteHubOptions(config)

        expect(viteHub).toMatchObject({
            host: 'cloudflare',
            name: 'liry24-com',
            publicUrl: 'https://liry24.com',
            auth: true,
            console: false,
            database: {
                driver: 'cloudflare',
                binding: 'DB',
                databaseName: 'liry24-com',
                databaseId: '227d818f-cd40-4fca-9710-b57273be94ca',
                previewDatabaseId: '3c7c6179-12d0-4108-9eea-b3e20d394cef',
            },
            blob: {
                driver: 'cloudflare',
                binding: 'STORAGE',
                bucketName: 'liry24-com',
                serve: { access: 'public', route: '/media' },
            },
            schedule: {
                providerOutput: 'nitro',
            },
            observability: {
                service: 'liry24-com',
                browserErrors: false,
                evlog: {
                    minLevel: 'info',
                    exclude: [
                        '/_nuxt/**',
                        '/favicon.ico',
                        '/robots.txt',
                        '/sitemap.xml',
                        '/media/**',
                    ],
                    sampling: {
                        rates: {
                            debug: 0,
                            info: 1,
                            warn: 100,
                            error: 100,
                        },
                        keep: [
                            { status: 500 },
                            { duration: 2000 },
                            { path: '/api/admin/**' },
                            { path: '/_vitehub/agents/**' },
                        ],
                    },
                },
            },
            agent: {
                invocations: 'database',
            },
        })

        expect(config.nitro?.cloudflare?.wrangler).toMatchObject({
            observability: {
                enabled: true,
                redact_query_string: true,
                logs: {
                    enabled: true,
                    invocation_logs: false,
                    head_sampling_rate: 1,
                },
                traces: {
                    enabled: false,
                },
                issues: {
                    enabled: false,
                },
            },
            workers_dev: false,
            preview_urls: true,
            routes: [
                {
                    pattern: 'liry24.com',
                    custom_domain: true,
                },
            ],
            previews: {
                vars: {
                    APP_ENV: 'dev',
                    NUXT_PUBLIC_SITE_URL: 'https://dev-liry24-com.liry.workers.dev',
                    NUXT_PUBLIC_IMAGES_DOMAIN: 'https://dev-liry24-com.liry.workers.dev',
                },
                d1_databases: [
                    {
                        binding: 'DB',
                        database_name: 'liry24-com-dev',
                        database_id: '3c7c6179-12d0-4108-9eea-b3e20d394cef',
                    },
                ],
                r2_buckets: [
                    {
                        binding: 'STORAGE',
                        bucket_name: 'liry24-com-dev-storage',
                    },
                ],
            },
        })
        expect(config.nitro?.cloudflare?.wrangler?.routes?.[0]).not.toHaveProperty(
            'previews_enabled',
        )
        expect(config.nitro?.cloudflare?.wrangler?.ai).toBeUndefined()
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})

test('ViteHub configuration supports synthetic overrides, disables AI gateway, and keeps server secrets off the client', async () => {
    const viteHub = getViteHubOptions(nuxtConfig)
    expect(viteHub.env?.public).toBeUndefined()

    expect(serverEnv.BETTER_AUTH_SECRET).toMatchObject({ secret: true })
    expect(serverEnv.POCKET_ID_CLIENT_SECRET).toMatchObject({ secret: true })
    expect(serverEnv.IGDB_CLIENT_SECRET).toMatchObject({ secret: true })
    expect(serverEnv.GOOGLE_GENERATIVE_AI_API_KEY).toMatchObject({ secret: true })

    expect('OPENAI_API_KEY' in serverEnv).toBe(false)
    expect('AI_GATEWAY_ID' in serverEnv).toBe(false)

    try {
        vi.stubEnv('APP_ENV', 'test')
        vi.stubEnv('LIRY24_HOST', 'node')
        vi.stubEnv('LIRY24_WORKER_NAME', 'liry24-synthetic')
        vi.stubEnv('LIRY24_DATABASE_NAME', 'synthetic-db')
        vi.stubEnv('LIRY24_DATABASE_ID', '00000000-0000-4000-8000-000000000200')
        vi.stubEnv('LIRY24_STORAGE_BUCKET', 'synthetic-storage')
        vi.stubEnv('LIRY24_DISABLE_CRON', 'true')
        vi.resetModules()

        const { default: config } = await import('../../nuxt.config')
        const overridden = getViteHubOptions(config)
        expect(overridden).toMatchObject({
            host: 'node',
            name: 'liry24-synthetic',
            database: expect.objectContaining({
                databaseName: 'synthetic-db',
                databaseId: '00000000-0000-4000-8000-000000000200',
            }),
            blob: expect.objectContaining({
                bucketName: 'synthetic-storage',
            }),
            schedule: {
                providerOutput: false,
            },
        })
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})

test('admin routes use the admin middleware, layout, and private caching', () => {
    expect(nuxtConfig.routeRules?.['/admin/**']).toMatchObject({
        appMiddleware: 'admin',
        appLayout: 'admin',
        headers: { 'cache-control': 'private, no-store' },
    })
})

test('Cloudflare Workers Builds treats main branch as production when APP_ENV is unset', async () => {
    try {
        vi.stubEnv('APP_ENV', '')
        vi.stubEnv('NUXT_PUBLIC_SITE_URL', '')
        vi.stubEnv('WORKERS_CI_BRANCH', 'main')
        vi.resetModules()

        const { default: prodConfig } = await import('../../nuxt.config')
        const prodViteHub = getViteHubOptions(prodConfig)
        expect(prodViteHub.publicUrl).toBe('https://liry24.com')
        expect(prodConfig.runtimeConfig).toMatchObject({
            public: {
                siteUrl: 'https://liry24.com',
                imagesDomain: 'https://images.liry24.com',
                preview: false,
            },
        })
        expect(prodConfig.nitro?.cloudflare?.wrangler?.vars).toMatchObject({
            APP_ENV: 'production',
        })

        vi.stubEnv('WORKERS_CI_BRANCH', 'dev')
        vi.resetModules()

        const { default: devConfig } = await import('../../nuxt.config')
        const devViteHub = getViteHubOptions(devConfig)
        expect(devViteHub.publicUrl).toBe('https://dev-liry24-com.liry.workers.dev')
        expect(devConfig.runtimeConfig).toMatchObject({
            public: {
                siteUrl: 'https://dev-liry24-com.liry.workers.dev',
                imagesDomain: 'https://dev-liry24-com.liry.workers.dev',
                preview: true,
            },
        })
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})

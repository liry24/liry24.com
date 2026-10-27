import { expect, test, vi } from 'vitest'

import nuxtConfig from '../../nuxt.config'

test('native definitions keep synthetic resources isolated and dev scheduling disabled', async () => {
    expect(nuxtConfig.nitro?.preset).toBeUndefined()
    try {
        for (const key of ['WORKER_NAME', 'DATABASE_NAME', 'MEDIA_BUCKET', 'CONTENT_BUCKET'])
            vi.stubEnv('LIRY24_' + key, '')
        for (const production of [false, true]) {
            vi.stubEnv('APP_ENV', production ? 'production' : 'dev')
            vi.stubEnv('LIRY24_TEST_CRON', 'false')
            vi.stubEnv('LIRY24_DATABASE_ID', '')
            vi.resetModules()
            const { default: config } = await import('../../nuxt.config')
            expect(config.modules).toEqual(
                expect.arrayContaining([
                    [
                        expect.anything(),
                        expect.objectContaining({
                            name: 'liry24-vitehub-synthetic',
                            schedule: { providerOutput: production ? 'nitro' : false },
                            database: expect.objectContaining({
                                driver: 'd1',
                                binding: 'DB',
                                databaseId: '00000000-0000-4000-8000-000000000100',
                            }),
                            blob: expect.objectContaining({
                                stores: {
                                    default: {
                                        driver: 'cloudflare-r2',
                                        binding: 'MEDIA',
                                        bucketName: 'liry24-vitehub-synthetic-media',
                                    },
                                    content: {
                                        driver: 'cloudflare-r2',
                                        binding: 'CONTENT',
                                        bucketName: 'liry24-vitehub-synthetic-content',
                                    },
                                },
                            }),
                        }),
                    ],
                ]),
            )
            expect(config.nitro?.cloudflare?.wrangler?.triggers?.crons).toEqual(
                production ? ['* * * * *'] : [],
            )
            const serialized = JSON.stringify(config)
            for (const id of [
                '227d818f-cd40-4fca-9710-b57273be94ca',
                '3c7c6179-12d0-4108-9eea-b3e20d394cef',
            ])
                expect(serialized).not.toContain(id)
        }
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})

test('native Env keeps credential declarations on the server', () => {
    const native = nuxtConfig.modules?.find((entry) => Array.isArray(entry) && entry[1]?.env) as [
        unknown,
        { env: { server: Record<string, { secret?: boolean }>; public?: unknown } },
    ]
    expect(native[1].env.public).toBeUndefined()
    for (const key of [
        'BETTER_AUTH_SECRET',
        'NUXT_APP_SECRET',
        'GITHUB_CLIENT_SECRET',
        'VERCEL_CLIENT_SECRET',
        'OPENAI_API_KEY',
    ])
        expect(native[1].env.server[key]?.secret).toBe(true)
})

test('admin routes use the permission-checking middleware and private caching', () => {
    expect(nuxtConfig.routeRules?.['/admin/**']).toMatchObject({
        appMiddleware: 'admin',
        headers: { 'cache-control': 'private, no-store' },
    })
})

test('local CI starts without remote AI bindings or Cloudflare credentials', async () => {
    try {
        vi.stubEnv('LIRY24_TEST_LOCAL', 'true')
        vi.resetModules()
        const { default: config } = await import('../../nuxt.config')
        expect(config.nitro?.cloudflare?.wrangler?.ai).toBeUndefined()
        expect(config.nitro?.cloudflare?.wrangler?.routes).toBeUndefined()
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})
test('native definitions accept an explicit isolated transition target and retain runtime environment', async () => {
    try {
        vi.stubEnv('APP_ENV', 'dev')
        for (const [key, value] of Object.entries({
            WORKER_NAME: 'synthetic-selected-worker',
            DATABASE_ID: '00000000-0000-4000-8000-000000000200',
            DATABASE_NAME: 'synthetic-selected-database',
            MEDIA_BUCKET: 'synthetic-selected-media',
            CONTENT_BUCKET: 'synthetic-selected-content',
        }))
            vi.stubEnv('LIRY24_' + key, value)
        vi.resetModules()
        const { default: config } = await import('../../nuxt.config')
        expect(config.modules).toContainEqual([
            expect.anything(),
            expect.objectContaining({
                name: 'synthetic-selected-worker',
                database: expect.objectContaining({
                    databaseId: '00000000-0000-4000-8000-000000000200',
                    databaseName: 'synthetic-selected-database',
                }),
                blob: expect.objectContaining({
                    stores: {
                        default: expect.objectContaining({
                            bucketName: 'synthetic-selected-media',
                        }),
                        content: expect.objectContaining({
                            bucketName: 'synthetic-selected-content',
                        }),
                    },
                }),
            }),
        ])
        expect(config.nitro?.cloudflare?.wrangler?.vars?.APP_ENV).toBe('dev')
        expect(config.nitro?.cloudflare?.wrangler?.triggers?.crons).toEqual([])
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})

import { readFile } from 'node:fs/promises'

import { expect, test, vi } from 'vitest'

import nuxtConfig from '../../nuxt.config'

const productionId = '227d818f-cd40-4fca-9710-b57273be94ca'
test('Void isolates dev and production resources and owns deployment configuration', async () => {
    expect(nuxtConfig.nitro?.externals).toBeUndefined()
    expect(nuxtConfig.nitro?.cloudflare).toBeUndefined()
    try {
        for (const production of [false, true]) {
            vi.stubEnv('APP_ENV', production ? 'production' : 'dev')
            vi.resetModules()
            const { default: config } = await import('../../void.config')
            const worker = config.cloudflare!
            expect(worker.name).toBe(production ? 'liry24-com' : 'liry24-com-dev')
            expect(worker.compatibility_flags).toContain('nodejs_compat_v2')
            expect(worker.compatibility_flags).toContain('nodejs_als')
            expect(worker.routes).toEqual(
                production ? [{ pattern: 'liry24.com', custom_domain: true }] : [],
            )
            expect(worker.triggers?.crons).toEqual(production ? ['* * * * *'] : [])
            expect(worker.d1_databases?.[0]).toMatchObject({
                binding: 'DB',
                migrations_dir: 'db/migrations',
                database_name: worker.name,
            })
            expect(worker.d1_databases?.[0]?.database_id).toBe(
                production ? productionId : undefined,
            )
            expect(worker.r2_buckets?.[0]).toMatchObject({
                binding: 'STORAGE',
                bucket_name: worker.name,
            })
            expect(worker.vars?.APP_ENV).toBe(production ? 'production' : 'dev')
            for (const name of ['BETTER_AUTH_SECRET', 'NUXT_APP_SECRET', 'GITHUB_CLIENT_SECRET'])
                expect(worker.vars).not.toHaveProperty(name)
        }
    } finally {
        vi.unstubAllEnvs()
        vi.resetModules()
    }
})

test('dev deployment delegates resources and migrations to Void without a production job', async () => {
    const workflow = await readFile('.github/workflows/preview.yml', 'utf8')
    expect(workflow).toContain('branches: [dev]')
    expect(workflow).toContain('void deploy --platform cloudflare')
    expect(workflow).not.toContain('scripts/preview.mjs')
    expect(workflow).not.toContain('preview:delete')
    expect(nuxtConfig.routeRules?.['/admin/**']).toMatchObject({
        auth: { user: { role: 'admin' } },
    })
})

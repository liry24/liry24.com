import { expect, test } from 'vitest'
import { experimental_readRawConfig } from 'wrangler'

test('production Wrangler config preserves infrastructure and required secret bindings', () => {
    const { rawConfig } = experimental_readRawConfig({ config: 'wrangler.jsonc' })
    expect(rawConfig.name).toBe('liry24-com')
    expect(rawConfig.compatibility_date).toBe('2026-07-30')
    expect(rawConfig.compatibility_flags).toEqual(['nodejs_compat', 'no_nodejs_compat_v2'])
    expect(rawConfig.workers_dev).toBe(false)
    expect(rawConfig.preview_urls).toBe(true)
    expect(rawConfig.routes).toEqual([{ pattern: 'liry24.com', custom_domain: true }])
    expect(rawConfig.triggers?.crons).toEqual(['* * * * *'])
    expect(rawConfig.d1_databases).toEqual([
        {
            binding: 'DB',
            database_name: 'liry24-com',
            database_id: '227d818f-cd40-4fca-9710-b57273be94ca',
        },
    ])
    expect(rawConfig.r2_buckets).toEqual([{ binding: 'R2', bucket_name: 'liry24-com' }])
    expect(rawConfig.secrets?.required).toEqual([
        'BETTER_AUTH_SECRET',
        'GITHUB_CLIENT_ID',
        'GITHUB_CLIENT_SECRET',
        'VERCEL_CLIENT_ID',
        'VERCEL_CLIENT_SECRET',
    ])
    for (const name of rawConfig.secrets!.required!) expect(rawConfig.vars).not.toHaveProperty(name)
})

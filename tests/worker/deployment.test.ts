import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { build, createNitro, prepare } from 'nitropack'
import { expect, test } from 'vitest'
import type { Unstable_RawConfig } from 'wrangler'

import nuxtConfig from '../../nuxt.config'

test('the generated auth provider stays inline on POSIX and Windows paths', () => {
    const inline = nuxtConfig.nitro!.externals!.inline!.find(
        (rule) => typeof rule === 'function',
    ) as (id: string) => boolean
    expect(inline('/app/.nuxt/better-auth/database.mjs')).toBe(true)
    expect(inline('C:\\app\\.nuxt\\better-auth\\database.mjs')).toBe(true)
    expect(inline('/app/.nuxt/site-admin/better-auth-server-plugin.mjs')).toBe(true)
    expect(inline('C:\\app\\.nuxt\\site-admin\\better-auth-server-plugin.mjs')).toBe(true)
    expect(inline('/app/node_modules/better-auth/dist/index.mjs')).toBe(false)
})

test('Nitro owns production settings and preserves infrastructure and required secret bindings', () => {
    const rawConfig = nuxtConfig.nitro!.cloudflare!.wrangler! as Unstable_RawConfig
    expect(rawConfig.name).toBe('liry24-com')
    expect(rawConfig.compatibility_date).toBe('2026-07-30')
    expect(rawConfig.compatibility_flags).toEqual([
        'nodejs_compat_v2',
        'enable_nodejs_process_v2',
        'nodejs_compat_populate_process_env',
    ])
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
    expect(rawConfig.ai).toEqual({ binding: 'AI' })
    expect(rawConfig.secrets?.required).toEqual([
        'BETTER_AUTH_SECRET',
        'GITHUB_CLIENT_ID',
        'GITHUB_CLIENT_SECRET',
        'VERCEL_CLIENT_ID',
        'VERCEL_CLIENT_SECRET',
    ])
    for (const name of rawConfig.secrets!.required!) expect(rawConfig.vars).not.toHaveProperty(name)
})

test('native Nitro generation preserves settings and v2 without an input Wrangler file', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'liry24-nitro-config-'))
    const cloudflare = nuxtConfig.nitro!.cloudflare!
    const nitro = await createNitro({
        rootDir,
        preset: 'cloudflare_module',
        compatibilityDate: '2026-07-30',
        nodeModulesDirs: [resolve('node_modules')],
        cloudflare,
    })
    try {
        await prepare(nitro)
        await build(nitro)
        const output = JSON.parse(
            await readFile(join(rootDir, '.output/server/wrangler.json'), 'utf8'),
        ) as Unstable_RawConfig
        const input = cloudflare.wrangler as Unstable_RawConfig
        for (const key of [
            'name',
            'account_id',
            'compatibility_date',
            'compatibility_flags',
            'workers_dev',
            'preview_urls',
            'routes',
            'triggers',
            'vars',
            'secrets',
            'd1_databases',
            'r2_buckets',
            'ai',
            'observability',
        ] as const)
            expect(output[key]).toEqual(input[key])
        expect(output.main).toBe('index.mjs')
        expect(output.assets).toMatchObject({
            binding: 'ASSETS',
            not_found_handling: '404-page',
        })
        expect(output.assets.directory.replaceAll('\\', '/')).toBe('../public')
        const redirect = JSON.parse(
            await readFile(join(rootDir, '.wrangler/deploy/config.json'), 'utf8'),
        )
        expect(redirect.configPath.replaceAll('\\', '/')).toBe('../../.output/server/wrangler.json')
    } finally {
        await nitro.close()
        await rm(rootDir, { recursive: true, force: true })
    }
}, 60_000)

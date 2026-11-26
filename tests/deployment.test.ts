import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

test.each([
    ['main', false, 'https://liry24.com', 'https://images.liry24.com'],
    [
        'dev',
        true,
        'https://dev-liry24-com.liry.workers.dev',
        'https://dev-liry24-com.liry.workers.dev',
    ],
])(
    'Workers Builds selects the public deployment for branch %s without APP_ENV',
    async (branch, preview, siteUrl, imagesDomain) => {
        vi.stubEnv('APP_ENV', '')
        vi.stubEnv('NUXT_PUBLIC_SITE_URL', '')
        vi.stubEnv('WORKERS_CI_BRANCH', branch)

        const { default: config } = await import('../nuxt.config')
        expect(config.runtimeConfig).toMatchObject({
            public: { siteUrl, imagesDomain, preview },
        })
    },
)

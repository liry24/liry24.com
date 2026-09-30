import { bindings, defineConfig, triggers } from 'cf/config'

import { workerName } from './scripts/preview-target.mjs'

export default defineConfig(({ isPreview }) => {
    const siteURL = isPreview ? process.env.PREVIEW_URL : 'https://liry24.com'
    const databaseId = isPreview
        ? process.env.PREVIEW_D1_ID
        : '227d818f-cd40-4fca-9710-b57273be94ca'
    const resourceName = isPreview ? process.env.PREVIEW_RESOURCE_NAME : 'liry24-com'
    if (!siteURL || !databaseId || !resourceName)
        throw new Error('Preview URL, D1 ID and resource name are required')

    return {
        accountId: '422bd946004c77eb0d569ec489b40196',
        worker: {
            name: workerName,
            entrypoint: './.output/server/index.mjs',
            compatibilityDate: '2026-07-30',
            compatibilityFlags: ['nodejs_compat', 'no_nodejs_compat_v2'],
            assets: { notFoundHandling: '404-page' },
            domains: isPreview ? [] : ['liry24.com'],
            triggers: isPreview ? [] : [triggers.scheduled({ schedule: '* * * * *' })],
            workersDev: isPreview,
            previewUrls: true,
            observability: { enabled: true, logs: { enabled: true, invocationLogs: true } },
            env: {
                ASSETS: bindings.assets(),
                DB: bindings.d1({ id: databaseId, name: resourceName }),
                R2: bindings.r2({ name: resourceName }),
                APP_ENV: bindings.text(isPreview ? 'preview' : 'production'),
                NUXT_PUBLIC_PREVIEW: bindings.text(isPreview ? 'true' : 'false'),
                NUXT_PUBLIC_SITE_URL: bindings.text(siteURL),
                NUXT_PUBLIC_IMAGES_DOMAIN: bindings.text(
                    isPreview ? siteURL : 'https://images.liry24.com',
                ),
                R2_DOMAIN: bindings.text(isPreview ? siteURL : 'https://images.liry24.com'),
                ...(isPreview
                    ? {
                          BETTER_AUTH_SECRET: bindings.secret(),
                          GITHUB_CLIENT_ID: bindings.secret(),
                          GITHUB_CLIENT_SECRET: bindings.secret(),
                          PREVIEW_GITHUB_TOKEN: bindings.secret(),
                      }
                    : {}),
            },
        },
    }
})

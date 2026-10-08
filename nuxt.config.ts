import { relative } from 'node:path'

import { createSiteAdminDependencyTypePaths } from '@liria24/site-admin/dependency-aliases'
import { defineNuxtConfig } from 'nuxt/config'
import { parseURL } from 'ufo'
import type { Unstable_RawConfig } from 'wrangler'

import { previewBindings } from './scripts/preview-target.mjs'

const isPreview = process.env.CLOUDFLARE_PREVIEW_BUILD === 'true'
const baseURL =
    (isPreview ? process.env.PREVIEW_URL : process.env.NUXT_PUBLIC_SITE_URL) || 'https://liry24.com'
const imagesDomain = isPreview ? baseURL : 'https://images.liry24.com'
const title = 'Liry24'

const cloudflareConfig = {
    name: 'liry24-com',
    account_id: '422bd946004c77eb0d569ec489b40196',
    compatibility_date: '2026-07-30',
    // Explicit v2 prevents Nitro 2's opt-out. Enable the process features used by auth at this date.
    compatibility_flags: [
        'nodejs_compat_v2',
        'enable_nodejs_process_v2',
        'nodejs_compat_populate_process_env',
    ],
    workers_dev: false,
    preview_urls: true,
    routes: [{ pattern: 'liry24.com', custom_domain: true }],
    triggers: { crons: ['* * * * *'] },
    assets: { not_found_handling: '404-page' },
    observability: { enabled: true, logs: { enabled: true, invocation_logs: true } },
    vars: {
        APP_ENV: 'production',
        NUXT_PUBLIC_PREVIEW: 'false',
        NUXT_PUBLIC_SITE_URL: 'https://liry24.com',
        NUXT_PUBLIC_IMAGES_DOMAIN: 'https://images.liry24.com',
        R2_DOMAIN: 'https://images.liry24.com',
    },
    secrets: {
        required: [
            'BETTER_AUTH_SECRET',
            'GITHUB_CLIENT_ID',
            'GITHUB_CLIENT_SECRET',
            'VERCEL_CLIENT_ID',
            'VERCEL_CLIENT_SECRET',
        ],
    },
    d1_databases: [
        {
            binding: 'DB',
            database_name: 'liry24-com',
            database_id: '227d818f-cd40-4fca-9710-b57273be94ca',
        },
    ],
    r2_buckets: [{ binding: 'R2', bucket_name: 'liry24-com' }],
    ai: { binding: 'AI' },
    dev: { ip: '127.0.0.1', port: 3100 },
    ...(isPreview
        ? {
              previews: previewBindings({
                  siteURL: process.env.PREVIEW_URL,
                  databaseId: process.env.PREVIEW_D1_ID,
                  resourceName: process.env.PREVIEW_RESOURCE_NAME,
              }),
          }
        : {}),
} satisfies Unstable_RawConfig

export default defineNuxtConfig({
    compatibilityDate: '2026-07-30',

    future: { compatibilityVersion: 5 },

    devtools: { enabled: true },

    css: ['~/assets/css/main.css'],

    imports: { presets: [{ from: 'cn', imports: ['cn'] }] },

    modules: [
        (_options, nuxt) => {
            nuxt.hook('modules:done', () => {
                nuxt.hook('prepare:types', ({ nodeTsConfig }) => {
                    // Nuxt strips declaration extensions from absolute paths. Keep
                    // the exported declarations explicit in the Node auth config project.
                    const paths = createSiteAdminDependencyTypePaths()
                    for (const [name, declarations] of Object.entries(paths))
                        paths[name] = declarations.map((path) => {
                            const target = relative(nuxt.options.buildDir, path).replaceAll(
                                '\\',
                                '/',
                            )
                            return target.startsWith('.') ? target : `./${target}`
                        })
                    nodeTsConfig.compilerOptions ??= {}
                    Object.assign((nodeTsConfig.compilerOptions.paths ??= {}), paths)
                })
            })
            // The application supplies Better Auth's adapter for the current request.
            nuxt.hook('better-auth:database:providers', (providers) => {
                providers.liry24 = {
                    priority: 1000,
                    isEnabled: () => true,
                    buildDatabaseCode:
                        () => `import { useSiteAdminRuntime } from '@liria24/site-admin/nuxt/server'
export const db = undefined
export function createDatabase(event) {
    const database = useSiteAdminRuntime().authDatabase?.(event?.context)
    if (!database) throw new Error('Application auth database is not initialized')
    return database
}`,
                }
            })
        },
        '@comark/nuxt',
        '@nuxt/ui',
        '@nuxt/image',
        '@vueuse/nuxt',
        '@nuxt/hints',
        '@nuxt/a11y',
        '@liria24/site-admin/nuxt',
        'motion-v/nuxt',
    ],

    components: [
        { path: '~/components/public' },
        { path: '~/components/admin', prefix: 'Admin' },
        { path: '~/components/OgImage', prefix: 'OgImage' },
    ],

    experimental: {
        sharedPrerenderData: true,
        crossOriginPrefetch: true,
        extractAsyncDataHandlers: true,
        typescriptPlugin: true,
        nitroAutoImports: true,
        prefetchPreloadTags: true,
    },

    vite: {
        optimizeDeps: {
            // Nuxt 4.6 module entries expose virtual #components imports to Vite's dependency scanner.
            noDiscovery: true,
            include: [
                '@unhead/schema-org/vue',
                '@better-auth/passkey/client',
                'better-auth/client/plugins',
                'better-auth/plugins',
                '@comark/vue',
                '@formkit/drag-and-drop',
                '@formkit/drag-and-drop/vue',
                '@tanstack/vue-form',
                '@yeger/vue-masonry-wall',
                'cn',
            ],
        },
    },

    runtimeConfig: {
        public: {
            siteUrl: baseURL,
            imagesDomain,
            preview: isPreview,
        },
    },

    hooks: {
        'nitro:config'(config) {
            // The auth module copies local .env secrets into runtimeConfig during a build.
            // Every deployment uses its own secret binding, never the build machine's secret.
            if (config.runtimeConfig) config.runtimeConfig.betterAuthSecret = ''
        },
    },

    routeRules: {
        '/': { swr: 300 },
        '/arts/**': { swr: 300 },
        '/works/**': { swr: 300 },
        '/posts/**': { swr: 300 },
        '/admin/**': {
            appMiddleware: 'admin',
            appLayout: 'admin',
            headers: { 'cache-control': 'private, no-store' },
        },
    },

    nitro: {
        preset: 'cloudflare_module',
        externals: {
            inline: [
                // Nuxt 4.6 renderer subpaths contain stubs that Nitro replaces during bundling.
                'nuxt/internal',
                // A predicate takes precedence over Nitro-dev's external build directory.
                // Bundle generated auth modules so their public dependency aliases resolve,
                // and the database provider shares the current Site Admin runtime.
                (id: string) =>
                    /\/(?:better-auth\/database|site-admin\/better-auth-server-plugin)\.mjs$/.test(
                        id.replaceAll('\\', '/'),
                    ),
            ],
        },
        // Passkey certificate verification needs this polyfill before tsyringe initializes.
        moduleSideEffects: ['reflect-metadata'],
        compressPublicAssets: true,
        experimental: { asyncContext: true },
        cloudflare: {
            deployConfig: true,
            nodeCompat: true,
            wrangler: cloudflareConfig,
        },
        prerender: {
            crawlLinks: false,
            failOnError: true,
        },
    },

    typescript: {
        tsConfig: {
            compilerOptions: {
                noUncheckedIndexedAccess: true,
                types: ['@cloudflare/workers-types'],
            },
        },
    },

    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
        head: {
            title,
            htmlAttrs: { prefix: 'og: https://ogp.me/ns#' },
            link: [{ rel: 'icon', href: '/favicon.ico' }],
        },
    },

    fonts: {
        defaults: { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
        families: [
            { name: 'Geist', provider: 'google', preload: true },
            { name: 'Geist Mono', provider: 'google', preload: true },
            {
                name: 'Special Gothic Expanded One',
                weights: [400],
                provider: 'google',
                preload: true,
                global: true,
            },
        ],
    },

    site: {
        url: baseURL,
    },

    llms: {
        domain: baseURL,
        description: 'Liry24 portfolio, artwork, and posts.',
        full: { description: 'All published Liry24 content.', title: 'Liry24 full content' },
        title,
    },

    ui: { experimental: { componentDetection: true } },

    icon: {
        clientBundle: {
            icons: ['mingcute:sun-fill', 'mingcute:moon-fill'],
            scan: true,
            includeCustomCollections: true,
        },
        serverBundle: {
            collections: [{ prefix: 'liria', fetchEndpoint: 'https://icons.liria.me/liria.json' }],
        },
    },

    siteAdmin: {
        ai: true,
        routing: { metadata: false },
    },

    auth: {
        redirects: { authenticated: '/admin', logout: '/' },
        schema: { usePlural: true },
    },

    i18n: {
        locales: ['ja'],
        defaultLocale: 'ja',
        strategy: 'no_prefix',
    },

    sitemap: {
        exclude: ['/admin', '/admin/**', '/login'],
    },

    robots: {
        disallow: ['/admin', '/api/site-admin', '/login'],
    },

    $development: {
        nitro: { preset: 'nitro-dev' },
        runtimeConfig: { public: { siteUrl: '' } },
    },

    $production: {
        image: {
            provider: isPreview ? 'none' : 'cloudflare',
            cloudflare: { baseURL },
            domains: [parseURL(imagesDomain).host!, 'avatars.githubusercontent.com'],
        },
    },
})

import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'
import { parseURL } from 'ufo'
import viteHub from 'vite-hub/nuxt'

import { serverEnv } from './env.ts'

const isPreview = process.env.APP_ENV !== 'production'
const baseURL =
    process.env.NUXT_PUBLIC_SITE_URL ||
    (isPreview ? 'https://liry24-com-dev.liry.workers.dev' : 'https://liry24.com')
const imagesDomain = isPreview ? baseURL : 'https://images.liry24.com'
const title = 'Liry24'

export default defineNuxtConfig({
    compatibilityDate: '2026-10-13',

    future: { compatibilityVersion: 5 },

    devtools: { enabled: true, timeline: { enabled: true } },

    css: ['~/assets/css/main.css'],

    imports: { presets: [{ from: 'cn', imports: ['cn'] }] },

    modules: [
        '@nuxt/fonts',
        '@comark/nuxt',
        '@nuxt/ui',
        '@nuxt/image',
        '@vueuse/nuxt',
        '@nuxt/hints',
        '@nuxt/a11y',
        '@nuxtjs/i18n',
        'nuxt-site-config',
        '@nuxtjs/sitemap',
        '@nuxtjs/robots',
        'nuxt-schema-org',
        'nuxt-og-image',
        'nuxt-seo-utils',
        [
            viteHub,
            {
                preset: process.env.LIRY24_PRESET === 'node' ? 'node' : 'cloudflare',
                name: process.env.LIRY24_WORKER_NAME || 'liry24-vitehub-synthetic',
                auth: true,
                env: { server: serverEnv },
                schedule: {
                    providerOutput:
                        process.env.APP_ENV === 'production' ||
                        process.env.LIRY24_TEST_CRON === 'true'
                            ? 'nitro'
                            : false,
                },
                publicUrl: baseURL,
                console: {
                    auth: 'app',
                    authorize: fileURLToPath(
                        new URL('./server/console-authorize.ts', import.meta.url),
                    ),
                },
                database: {
                    driver: 'd1',
                    binding: 'DB',
                    databaseName: process.env.LIRY24_DATABASE_NAME || 'liry24-vitehub-synthetic',
                    databaseId:
                        process.env.LIRY24_DATABASE_ID || '00000000-0000-4000-8000-000000000100',
                },
                blob: {
                    stores: {
                        default: {
                            driver: 'cloudflare-r2',
                            binding: 'MEDIA',
                            bucketName:
                                process.env.LIRY24_MEDIA_BUCKET || 'liry24-vitehub-synthetic-media',
                        },
                        content: {
                            driver: 'cloudflare-r2',
                            binding: 'CONTENT',
                            bucketName:
                                process.env.LIRY24_CONTENT_BUCKET ||
                                'liry24-vitehub-synthetic-content',
                        },
                    },
                    serve: { route: '/media', store: 'default' },
                },
            },
        ],
        'liti/nuxt',
        '@litijs/blog/nuxt',
        [
            'nuxt-llms',
            {
                domain: baseURL,
                description: 'Liry24 portfolio, artwork, and posts.',
                full: {
                    description: 'All published Liry24 content.',
                    title: 'Liry24 full content',
                },
                title,
            },
        ],
        'motion-v/nuxt',
    ],

    extends: ['~~/layers/cursor', '~~/layers/icons', '~~/layers/squircle', '~~/layers/sentence'],

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
        // Passkey certificate verification needs this polyfill before tsyringe initializes.
        moduleSideEffects: ['reflect-metadata'],
        compressPublicAssets: true,
        experimental: { asyncContext: true },
        cloudflare: {
            wrangler: {
                vars: { APP_ENV: process.env.APP_ENV || 'dev' },
                ...(process.env.LIRY24_TEST_LOCAL === 'true' ? {} : { ai: { binding: 'AI' } }),
                triggers: { crons: process.env.APP_ENV === 'production' ? ['* * * * *'] : [] },
            },
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
        nodeTsConfig: {
            compilerOptions: {
                paths: {
                    // Nuxt 4.6 typechecks this file with moduleResolution nodenext and maps
                    // nitropack/types onto a concrete declaration. nitropack's presets entry
                    // re-exports without a file extension, so nodenext drops preset keys such
                    // as cloudflare. Load the declaration that defines those keys.
                    'nitropack/presets': ['../node_modules/nitropack/dist/presets/_types.gen.d.ts'],
                },
            },
        },
    },

    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
        layoutTransition: { name: 'page', mode: 'out-in' },
        head: {
            title,
            titleTemplate: '%s | Liry24',
            htmlAttrs: { prefix: 'og: https://ogp.me/ns#' },
            link: [{ rel: 'icon', href: '/favicon.ico' }],
        },
    },

    fonts: {
        defaults: { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
        families: [
            { name: 'Geist', provider: 'google', preload: true, global: true },
            { name: 'Geist Mono', provider: 'google', preload: true, global: true },
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
        name: title,
    },

    ui: { experimental: { componentDetection: true } },

    icon: {
        clientBundle: {
            icons: [
                'mingcute:sun-fill',
                'mingcute:moon-fill',
                'mingcute:pad-line',
                'mingcute:cellphone-line',
                'mingcute:computer-line',
            ],
            scan: true,
            includeCustomCollections: true,
        },
        serverBundle: {
            collections: [{ prefix: 'liria', fetchEndpoint: 'https://icons.liria.me/liria.json' }],
        },
    },

    liti: { workspace: 'content' },

    i18n: {
        locales: ['ja'],
        defaultLocale: 'ja',
        strategy: 'no_prefix',
    },

    sitemap: {
        exclude: ['/admin', '/admin/**', '/login'],
        sources: ['/api/sitemap/posts'],
    },

    robots: {
        disallow: ['/admin', '/api/admin', '/api/_liti/manage', '/_vitehub', '/login'],
    },

    $development: {
        // Background SSR warmup discovers OG font weights and restarts Nitro during requests.
        vite: { warmupEntry: false },
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

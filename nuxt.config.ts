import { randomBytes } from 'node:crypto'

import { defineNuxtConfig } from 'nuxt/config'
import { parseURL } from 'ufo'
import viteHub from 'vite-hub/nuxt'

import { developmentServerEnv, serverEnv } from './env.ts'
import { liriaIconCollection } from './layers/icons/liria.ts'

const appEnv =
    process.env.APP_ENV || (process.env.WORKERS_CI_BRANCH === 'main' ? 'production' : undefined)
const isPreview = appEnv !== 'production'
const baseURL =
    process.env.NUXT_PUBLIC_SITE_URL ||
    (isPreview ? 'https://dev-liry24-com.liry.workers.dev' : 'https://liry24.com')
const imagesDomain = isPreview ? baseURL : 'https://images.liry24.com'
const igdbClientId = process.env.IGDB_CLIENT_ID || '907z6pjakj7oiu1oyqhnepvktcw10p'
const title = 'Liry24'
const diagnostics = process.env.NUXT_DIAGNOSTICS === '1'
let localAdmin = { origin: '', secret: '' }

export default defineNuxtConfig({
    compatibilityDate: '2026-10-13',

    future: { compatibilityVersion: 5 },

    devtools: { enabled: true, timeline: { enabled: false } },

    a11y: { enabled: false },

    css: [
        '~/assets/css/main.css',
        '~/assets/css/cursor.css',
        '~/assets/css/sentence.css',
        '~/assets/css/squircle.css',
    ],

    imports: { presets: [{ from: 'cn', imports: ['cn'] }] },

    modules: [
        '@nuxt/fonts',
        '@nuxt/ui',
        '@liry24/ui/nuxt',
        '@comark/vue',
        viteHub,
        '@nuxt/image',
        '@vueuse/nuxt',
        '@nuxt/a11y',
        'nuxt-site-config',
        '@nuxtjs/sitemap',
        '@nuxtjs/robots',
        'nuxt-schema-org',
        'nuxt-og-image',
        'nuxt-seo-utils',
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

    vitehub: {
        host: 'cloudflare',
        name: 'liry24-com',
        publicUrl: baseURL,
        auth: true,
        console: false,
        env: { server: serverEnv },
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
            providerOutput: process.env.LIRY24_DISABLE_CRON === 'true' ? false : 'nitro',
        },
        observability: {
            service: 'liry24-com',
            browserErrors: false,
            evlog: {
                minLevel: 'info',
                exclude: ['/_nuxt/**', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/media/**'],
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
    },

    extends: ['~~/layers/icons'],

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

    build: {
        transpile: ['@vite-hub/ui'],
    },

    vite: {
        optimizeDeps: {
            noDiscovery: true,
            include: [
                '@unhead/schema-org/vue',
                '@comark/vue',
                '@yeger/vue-masonry-wall',
                '@tanstack/charts',
                '@tanstack/charts/vue',
                '@tanstack/charts/scales/band',
                '@tanstack/charts/scales/linear',
                '@tanstack/charts/scales/ordinal',
                '@tanstack/charts/scales/point',
                '@tanstack/charts/crosshair',
                '@tanstack/charts/mark/decorative',
                '@tanstack/charts/polar',
                '@lucasmarkes/hairline',
                'cn',
            ],
        },
    },

    runtimeConfig: {
        localAdmin: { origin: '', secret: '' },
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
        compressPublicAssets: true,
        experimental: { asyncContext: true },
        cloudflare: {
            wrangler: {
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
                vars: {
                    APP_ENV: appEnv || 'production',
                    LIRY24_POST_PUBLISH_AI: isPreview
                        ? 'false'
                        : (process.env.LIRY24_POST_PUBLISH_AI ?? 'true'),
                    IGDB_CLIENT_ID: igdbClientId,
                },
                routes: [
                    {
                        pattern: 'liry24.com',
                        custom_domain: true,
                    },
                ],
                workers_dev: false,
                preview_urls: true,
                previews: {
                    vars: {
                        APP_ENV: 'dev',
                        LIRY24_POST_PUBLISH_AI: 'false',
                        IGDB_CLIENT_ID: igdbClientId,
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

    liryUi: { css: false },

    fonts: {
        defaults: { weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
        families: [
            {
                name: 'Inter',
                weights: [100, 200, 300, 400, 500, 600, 700, 800],
                provider: 'google',
                preload: true,
                global: true,
            },
            {
                name: 'Geist',
                weights: [100, 200, 400, 700, 800],
                provider: 'google',
                preload: false,
                global: true,
            },
            {
                name: 'Geist Mono',
                weights: [300, 400, 500, 700],
                styles: ['normal'],
                provider: 'google',
                preload: true,
                global: true,
            },
            {
                name: 'Noto Sans JP',
                weights: [400, 700],
                provider: 'google',
                preload: false,
                global: false,
            },
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

    ui: {
        fonts: false,
        experimental: { componentDetection: true },
    },

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
            collections: [liriaIconCollection],
        },
    },

    sitemap: {
        exclude: ['/admin', '/admin/**'],
        sources: ['/api/sitemap/posts'],
    },

    robots: {
        disallow: ['/admin', '/api/admin', '/_vitehub'],
    },

    $development: {
        devServer: { host: '127.0.0.1' },
        hooks: {
            listen(server, listener: unknown) {
                const address = server.address()
                if (address && typeof address === 'object') {
                    const host = address.address === '::1' ? '[::1]' : address.address
                    if (host === '127.0.0.1' || host === '[::1]') {
                        const https =
                            listener && typeof listener === 'object' && 'https' in listener
                                ? listener.https
                                : false
                        const protocol = https ? 'https' : 'http'
                        localAdmin = {
                            origin: new URL(`${protocol}://${host}:${address.port}`).origin,
                            secret: randomBytes(32).toString('hex'),
                        }
                        return
                    }
                }
                localAdmin = { origin: '', secret: '' }
            },
            'nitro:build:before'(nitro) {
                nitro.options.runtimeConfig.localAdmin = localAdmin
            },
        },
        modules: diagnostics ? ['@nuxt/hints'] : [],
        a11y: { enabled: diagnostics },
        devtools: { timeline: { enabled: diagnostics } },
        vite: { warmupEntry: false },
        runtimeConfig: { public: { siteUrl: '' } },
        vitehub: { env: { server: developmentServerEnv }, logs: true },
    },

    $production: {
        image: {
            provider: isPreview ? 'none' : 'cloudflare',
            cloudflare: { baseURL },
            domains: (() => {
                const host = parseURL(imagesDomain).host
                return host ? [host] : []
            })(),
        },
    },
})

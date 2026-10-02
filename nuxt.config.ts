import { execFileSync } from 'node:child_process'

import { parseURL } from 'ufo'

const isPreview = process.env.CLOUDFLARE_PREVIEW_BUILD === 'true'
const baseURL =
    (isPreview ? process.env.PREVIEW_URL : import.meta.env.NUXT_PUBLIC_SITE_URL) ||
    'https://liry24.com'
const imagesDomain = isPreview ? baseURL : 'https://images.liry24.com'
const title = 'Liry24'

export default defineNuxtConfig({
    compatibilityDate: '2026-07-30',

    future: { compatibilityVersion: 5 },

    devtools: { enabled: true },

    css: ['~/assets/css/main.css'],

    imports: { presets: [{ from: 'cn', imports: ['cn'] }] },

    modules: [
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
        // Passkey certificate verification needs this polyfill before tsyringe initializes.
        moduleSideEffects: ['reflect-metadata'],
        compressPublicAssets: true,
        experimental: { asyncContext: true },
        hooks: {
            compiled(nitro) {
                // Nitro 2 does not emit cf Build Output yet; Wrangler bundles its final output.
                if (!nitro.options.dev)
                    execFileSync(
                        process.execPath,
                        ['node_modules/wrangler/bin/cf-wrangler.js', 'build'],
                        {
                            stdio: 'inherit',
                        },
                    )
            },
        },
        cloudflare: {
            deployConfig: false,
            nodeCompat: true,
            dev: {
                configPath: './wrangler.local.jsonc',
                persistDir: './.data/unified',
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
                types: ['@cloudflare/workers-types', 'bun'],
            },
        },
    },

    app: {
        pageTransition: { name: 'page', mode: 'out-in' },
        head: { title, htmlAttrs: { prefix: 'og: https://ogp.me/ns#' } },
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
        assets: {
            storage: 'content',
            separateDrafts: false,
            cleanup: { minimumAge: 60 * 60 * 24 },
        },
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

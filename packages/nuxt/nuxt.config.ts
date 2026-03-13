// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: 'latest',

    future: {
        compatibilityVersion: 5,
    },

    devtools: {
        enabled: true,
        timeline: {
            enabled: true,
        },
    },

    modules: [
        '@nuxt/ui',
        '@nuxt/image',
        '@nuxt/content',
        '@vueuse/nuxt',
        '@vercel/analytics',
        '@nuxt/hints',
        '@nuxt/a11y',
    ],

    vite: {
        vue: {
            features: {
                optionsAPI: false,
            },
        },
        optimizeDeps: {
            include: [
                'vue',
                '@nuxt/ui > prosemirror-state',
                '@nuxt/ui > prosemirror-transform',
                '@nuxt/ui > prosemirror-model',
                '@nuxt/ui > prosemirror-view',
                '@nuxt/ui > prosemirror-gapcursor',
            ],
        },
    },

    nitro: {
        preset: 'vercel',
        compressPublicAssets: true,
        vercel: {
            config: {
                images: {
                    minimumCacheTTL: 2678400, // 31 days
                },
            },
        },
        typescript: {
            tsConfig: {
                compilerOptions: {
                    noUncheckedIndexedAccess: true,
                },
            },
        },
        experimental: {
            asyncContext: true,
        },
    },

    experimental: {
        crossOriginPrefetch: true,
        extractAsyncDataHandlers: true,
        inlineRouteRules: true,
        sharedPrerenderData: true,
        typescriptPlugin: true,
        nitroAutoImports: true,
    },

    app: {
        head: {
            meta: [
                { charset: 'utf-8' },
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            ],
        },
    },

    content: {
        build: {
            markdown: {
                remarkPlugins: {
                    'remark-breaks': {},
                },
            },
        },
        experimental: { sqliteConnector: 'native' },
    },

    icon: {
        clientBundle: {
            scan: true,
            includeCustomCollections: true,
        },
        serverBundle: {
            collections: [{ prefix: 'liria', fetchEndpoint: 'https://icon.liria.me/liria.json' }],
        },
    },

    ui: {
        experimental: {
            componentDetection: true,
        },
    },
})

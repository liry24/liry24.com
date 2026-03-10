import { parseURL } from 'ufo'

const title = 'Liry24 Admin'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    extends: ['@repo/nuxt'],

    devServer: {
        port: 3001,
    },

    modules: ['motion-v/nuxt'],

    css: ['~/assets/css/main.css'],

    runtimeConfig: {
        public: {
            homeDomain: process.env.HOME_DOMAIN,
            adminDomain: process.env.ADMIN_DOMAIN,
            imagesDomain: process.env.TIGRIS_STORAGE_DOMAIN,
        },
        aiGateway: {
            apiKey: process.env.AI_GATEWAY_API_KEY,
        },
        allowSignup: process.env.ALLOW_SIGNUP,
        betterAuth: {
            secret: process.env.BETTER_AUTH_SECRET,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
        tigrisStorage: {
            accessKeyId: process.env.TIGRIS_STORAGE_ACCESS_KEY_ID,
            secretAccessKey: process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY,
            bucket: process.env.TIGRIS_STORAGE_BUCKET,
            domain: process.env.TIGRIS_STORAGE_DOMAIN,
        },
        turso: {
            databaseUrl: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        },
        vercel: {
            clientId: process.env.VERCEL_CLIENT_ID,
            clientSecret: process.env.VERCEL_CLIENT_SECRET,
        },
    },

    nitro: {
        externals: {
            inline: ['drizzle-orm'],
        },
        storage: {
            auth: {
                driver: 'vercel-runtime-cache',
                tags: ['auth'],
            },
        },
        devStorage: {
            auth: {
                driver: 'fs-lite',
                base: '.data/devStorage/auth',
            },
        },
    },

    vite: {
        optimizeDeps: {
            include: ['drizzle-orm'],
        },
    },

    routeRules: {
        '/**': { appMiddleware: 'admin' },
    },

    app: {
        head: {
            title,
            htmlAttrs: { lang: 'ja', prefix: 'og: https://ogp.me/ns#' },
        },
    },

    fonts: {
        families: [
            { name: 'Geist', provider: 'google' },
            { name: 'Geist Mono', provider: 'google' },
        ],
        defaults: {
            weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
        },
    },

    icon: {
        clientBundle: {
            icons: ['mingcute:sun-fill', 'mingcute:moon-fill'],
        },
    },

    image: {
        domains: [
            parseURL(process.env.TIGRIS_STORAGE_DOMAIN).host!,
            'avatars.githubusercontent.com',
        ],
    },
})

import { env } from 'vite-hub/env'

const production = process.env.APP_ENV === 'production'
const synthetic = process.env.LIRY24_TEST_LOCAL === 'true' || process.env.APP_ENV === 'test'
const secret = (required = true) => env({ secret: true, required })

export const serverEnv = {
    BETTER_AUTH_SECRET: secret(),
    NUXT_APP_SECRET: secret(),
    GITHUB_CLIENT_ID: env({ required: !synthetic }),
    GITHUB_CLIENT_SECRET: secret(!synthetic),
    PREVIEW_GITHUB_TOKEN: secret(!production && !synthetic),
    VERCEL_CLIENT_ID: env({ required: production && !synthetic }),
    VERCEL_CLIENT_SECRET: secret(production && !synthetic),
    IGDB_CLIENT_ID: env({ required: false }),
    IGDB_CLIENT_SECRET: secret(false),
    OPENAI_API_KEY: secret(false),
    OPENAI_BASE_URL: secret(false),
}

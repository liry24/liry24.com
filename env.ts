import { env } from 'vite-hub/env'

const synthetic = process.env.LIRY24_TEST_LOCAL === 'true' || process.env.APP_ENV === 'test'
const secret = (required = true) => env({ secret: true, required })

export const serverEnv = {
    BETTER_AUTH_SECRET: secret(),
    NUXT_APP_SECRET: secret(),
    POCKET_ID_CLIENT_ID: env({ required: !synthetic }),
    POCKET_ID_CLIENT_SECRET: secret(!synthetic),
    ...(synthetic ? { POCKET_ID_TEST_ISSUER: env({ required: false }) } : {}),
    IGDB_CLIENT_ID: env({ required: false }),
    IGDB_CLIENT_SECRET: secret(false),
    OPENAI_API_KEY: secret(false),
    OPENAI_BASE_URL: secret(false),
}

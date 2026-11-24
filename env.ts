import { env } from 'vite-hub/env'

const synthetic = process.env.LIRY24_TEST_LOCAL === 'true' || process.env.APP_ENV === 'test'

export const serverEnv = {
    BETTER_AUTH_SECRET: env({ secret: true }),
    POCKET_ID_CLIENT_ID: env(synthetic ? { optional: true } : {}),
    POCKET_ID_CLIENT_SECRET: env(synthetic ? { secret: true, optional: true } : { secret: true }),
    POCKET_ID_ISSUER: env({ default: 'https://sso.liry24.com' }),
    POCKET_ID_ADMIN_EMAIL: env({ optional: true }),
    POCKET_ID_ADMIN_SUB: env({ optional: true }),
    IGDB_CLIENT_ID: env({ optional: true }),
    IGDB_CLIENT_SECRET: env({ secret: true, optional: true }),
    GOOGLE_GENERATIVE_AI_API_KEY: env({ secret: true, optional: true }),
}

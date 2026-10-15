import { defineEnv, string } from 'void/env'
import { z } from 'zod'

const production = process.env.APP_ENV === 'production'
export default defineEnv({
    BETTER_AUTH_SECRET: z.string().min(32),
    NUXT_APP_SECRET: z.string().min(32),
    GITHUB_CLIENT_ID: string(),
    GITHUB_CLIENT_SECRET: string(),
    PREVIEW_GITHUB_TOKEN: production ? string().optional() : string(),
    VERCEL_CLIENT_ID: production ? string() : string().optional(),
    VERCEL_CLIENT_SECRET: production ? string() : string().optional(),
    OPENAI_API_KEY: string().optional(),
})

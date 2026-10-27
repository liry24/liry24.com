import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { defineAuth } from 'vite-hub/auth'
import { useDatabase } from 'vite-hub/database/drizzle'

import * as schema from './database/auth-schema'
import { createAuthOptions } from './utils/authOptions'

export default defineAuth({
    plugins: createAuthOptions().plugins,
    database: true,
    runtime: ({ requestOrigin }) => ({
        ...createAuthOptions(),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: requestOrigin,
        database: drizzleAdapter(useDatabase('default').db, { provider: 'sqlite', schema }),
    }),
})

import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, username, testUtils } from 'better-auth/plugins'

import * as schema from '../../../db/schema'
import { db } from './database'

export const auth = betterAuth({
    baseURL: 'http://localhost',
    secret: 'synthetic-auth-secret-0123456789abcdef',
    database: drizzleAdapter(db, { provider: 'sqlite', schema, usePlural: true }),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [
        testUtils(),
        admin({
            ac: adminAccess,
            roles: {
                ...adminRoles,
                reader: adminAccess.newRole({ user: ['list', 'get'], activity: ['readOwn'] }),
                auditor: adminAccess.newRole({ activity: ['readOwn', 'readAny'] }),
            },
        }),
        username({
            minUsernameLength: 1,
            usernameValidator: (value) => /^[a-z\d_.-]{1,64}$/i.test(value),
        }),
        authActivity,
        passkey(),
    ],
})

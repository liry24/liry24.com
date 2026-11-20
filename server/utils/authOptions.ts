import type { BetterAuthOptions } from 'better-auth'
import { admin, genericOAuth, jwt, username } from 'better-auth/plugins'

import { authActivity } from '../../packages/admin-activity/server/utils/authActivity.js'
import { adminAccess, adminRoles } from '../../shared/utils/authAccess.js'

export function createAuthOptions() {
    const synthetic = process.env.LIRY24_TEST_LOCAL === 'true' || process.env.APP_ENV === 'test'
    const issuer = synthetic
        ? (process.env.POCKET_ID_TEST_ISSUER ?? 'http://127.0.0.1:1')
        : 'https://sso.liry24.com'
    return {
        appName: 'liry24',
        trustedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3100',
            'http://127.0.0.1:3100',
            'https://liry24.com',
            'https://liry24-com-dev.liry.workers.dev',
        ],
        disabledPaths: ['/sign-in/username', '/link-social', '/unlink-account'],
        account: {
            additionalFields: { issuer: { type: 'string', required: false, input: false } },
            storeStateStrategy: 'database',
            updateAccountOnSignIn: true,
            accountLinking: { enabled: false, disableImplicitLinking: true },
        },
        session: {
            expiresIn: 60 * 60 * 24 * 30,
            updateAge: 60 * 60 * 24,
            freshAge: 0,
            cookieCache: { enabled: true, maxAge: 60 * 5 },
        },
        rateLimit: {
            enabled: true,
            storage: 'database',
            window: 60,
            max: 100,
            customRules: {
                '/sign-in/social': { window: 60, max: 10 },
                '/get-session': { window: 60, max: 200 },
            },
        },
        emailAndPassword: { enabled: false },
        plugins: [
            admin({ ac: adminAccess, roles: adminRoles, defaultRole: 'user' }),
            username({
                minUsernameLength: 1,
                maxUsernameLength: 64,
                usernameValidator: (value) => /^[a-z\d_.-]{1,64}$/i.test(value),
            }),
            {
                ...genericOAuth({
                    config: [
                        {
                            providerId: 'pocket-id',
                            discoveryUrl: `${issuer}/.well-known/openid-configuration`,
                            clientId: process.env.POCKET_ID_CLIENT_ID ?? 'offline-schema-client',
                            clientSecret: process.env.POCKET_ID_CLIENT_SECRET,
                            scopes: ['openid', 'profile', 'email'],
                            pkce: true,
                            requireIdTokenVerification: true,
                            disableProviderLogout: true,
                        },
                    ],
                }),
                schema: {
                    account: {
                        fields: {},
                        indexes: [
                            {
                                name: 'account_oidc_identity',
                                fields: ['providerId', 'accountId'],
                                unique: true,
                            },
                        ],
                    },
                },
            },
            authActivity,
            jwt({
                schema: { jwks: { modelName: 'jwk' } },
                disableSettingJwtHeader: true,
                jwks: { rotationInterval: 60 * 60 * 24 * 30, gracePeriod: 60 * 60 * 24 * 30 },
            }),
        ],
        user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
        advanced: {
            // A new namespace rejects old cached sessions as well as old session tokens.
            cookiePrefix: 'liry24-pocket',
            database: { joins: true },
            ipAddress: {
                ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
                disableIpTracking: false,
            },
            useSecureCookies: process.env.NODE_ENV === 'production',
            disableCSRFCheck: false,
            defaultCookieAttributes: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            },
        },
    } satisfies BetterAuthOptions
}

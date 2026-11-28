import { admin, genericOAuth } from 'better-auth/plugins'
import { defineAuth } from 'vite-hub/auth'
import { authDatabase } from 'vite-hub/auth/database'

import {
    buildTrustedOrigins,
    normalizeIssuer,
    parseCsvList,
    resolveAuthBaseUrl,
} from './utils/authOrigin.js'
import { localAdminAuth, localAdminPlugin } from './utils/localAdminAuth.js'
import { readProcessEnv } from './utils/processEnv.js'
import { readSecretValue } from './utils/secret.js'

const readEnvString = (value: unknown): string | undefined =>
    typeof value === 'string' && value ? value : undefined

export default defineAuth(({ env, request, requestOrigin }) => {
    const local = import.meta.dev && request ? localAdminAuth(requestOrigin) : undefined
    const appEnv = readEnvString(env.APP_ENV) ?? readProcessEnv('APP_ENV')
    const testLocal = readEnvString(env.LIRY24_TEST_LOCAL) ?? readProcessEnv('LIRY24_TEST_LOCAL')
    const synthetic = testLocal === 'true' || appEnv === 'test'
    const testIssuer = synthetic
        ? (readEnvString(env.POCKET_ID_TEST_ISSUER) ?? readProcessEnv('POCKET_ID_TEST_ISSUER'))
        : undefined
    const issuer = normalizeIssuer(testIssuer ?? env.POCKET_ID_ISSUER)
    const runtimeSiteUrl =
        readEnvString(env.NUXT_PUBLIC_SITE_URL) ?? readProcessEnv('NUXT_PUBLIC_SITE_URL')
    const authBaseUrl = local
        ? requestOrigin
        : resolveAuthBaseUrl(requestOrigin, runtimeSiteUrl, synthetic, appEnv)
    const isHttps = authBaseUrl.startsWith('https://')
    const adminEmails = new Set(
        parseCsvList(env.POCKET_ID_ADMIN_EMAIL).map((email) => email.toLowerCase()),
    )
    const adminSubs = new Set(parseCsvList(env.POCKET_ID_ADMIN_SUB))
    const clientId = env.POCKET_ID_CLIENT_ID || 'offline-schema-client'
    const clientSecret = readSecretValue(env.POCKET_ID_CLIENT_SECRET)
    const disablePocketId =
        local || (import.meta.dev && (clientId === 'offline-schema-client' || !clientSecret))

    const trustedOrigins = buildTrustedOrigins(authBaseUrl)

    return {
        appName: 'liry24',
        baseURL: authBaseUrl,
        database: authDatabase(),
        trustedOrigins,
        secret: local?.secret ?? readSecretValue(env.BETTER_AUTH_SECRET),
        disabledPaths: [
            '/sign-in/username',
            '/link-social',
            '/unlink-account',
            ...(disablePocketId ? ['/sign-in/social', '/sign-in/oauth2'] : []),
        ],
        emailAndPassword: { enabled: false },
        account: {
            additionalFields: {
                issuer: { type: 'string', required: false, input: false },
            },
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
        user: {
            changeEmail: { enabled: false },
        },
        databaseHooks: {
            user: {
                create: {
                    before: async (user) => {
                        const email = typeof user.email === 'string' ? user.email.toLowerCase() : ''
                        if (adminEmails.size > 0) {
                            if (adminEmails.has(email)) return { data: { ...user, role: 'admin' } }

                            if (adminSubs.size === 0) return false
                        }
                        return { data: user }
                    },
                },
            },
            account: {
                create: {
                    before: async (account) => {
                        const hasIssuer =
                            'issuer' in account &&
                            typeof account.issuer === 'string' &&
                            account.issuer.length > 0
                        const withIssuer =
                            account.providerId === 'pocket-id' && !hasIssuer
                                ? { ...account, issuer }
                                : account
                        if (
                            adminSubs.size > 0 &&
                            account.providerId === 'pocket-id' &&
                            !adminSubs.has(account.accountId)
                        )
                            return false

                        return { data: withIssuer }
                    },
                    after: async (account, ctx) => {
                        if (
                            account.providerId === 'pocket-id' &&
                            adminSubs.size > 0 &&
                            adminSubs.has(account.accountId) &&
                            ctx?.context?.internalAdapter
                        ) {
                            await ctx.context.internalAdapter.updateUser(account.userId, {
                                role: 'admin',
                            })
                        }
                    },
                },
            },
        },
        plugins: [
            admin({ defaultRole: 'user' }),
            ...(local ? [localAdminPlugin] : []),
            {
                ...genericOAuth({
                    config: [
                        {
                            providerId: 'pocket-id',
                            discoveryUrl: `${issuer}/.well-known/openid-configuration`,
                            clientId,
                            clientSecret,
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
        ],
        advanced: {
            cookiePrefix: local ? 'liry24-local' : 'liry24-pocket',
            database: {
                joins: true,
            },
            ipAddress: {
                ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
                disableIpTracking: false,
            },
            useSecureCookies: isHttps,
            disableCSRFCheck: false,
            defaultCookieAttributes: {
                httpOnly: true,
                secure: isHttps,
                sameSite: 'lax',
            },
        },
    }
})

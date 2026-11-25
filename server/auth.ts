import { admin, genericOAuth } from 'better-auth/plugins'
import { defineAuth } from 'vite-hub/auth'
import { authDatabase } from 'vite-hub/auth/database'

import { readSecretValue } from './utils/secret.js'

const parseList = (value: string | undefined): Array<string> =>
    (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

const normalizeIssuer = (value: string | undefined): string =>
    (value || 'https://sso.liry24.com').replace(/\/+$/u, '')

function resolveAuthBaseUrl(
    origin: string,
    runtimeSiteUrl: string | undefined,
    isSynthetic: boolean,
    appEnv: string | undefined,
): string {
    if (origin === 'https://liry24.com' || origin === 'https://dev-liry24-com.liry.workers.dev') {
        return origin
    }
    try {
        const parsed = new URL(origin)
        if (
            isSynthetic &&
            parsed.protocol === 'http:' &&
            (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
        ) {
            return parsed.origin
        }
        if (
            appEnv !== 'production' &&
            parsed.protocol === 'https:' &&
            parsed.hostname.endsWith('.workers.dev')
        ) {
            return parsed.origin
        }
    } catch {
        // Fall back to configured URL below
    }
    return runtimeSiteUrl || 'https://liry24.com'
}

export default defineAuth(({ env, requestOrigin }) => {
    const appEnv = typeof env.APP_ENV === 'string' ? env.APP_ENV : process.env.APP_ENV
    const testLocal =
        typeof env.LIRY24_TEST_LOCAL === 'string'
            ? env.LIRY24_TEST_LOCAL
            : process.env.LIRY24_TEST_LOCAL
    const synthetic = testLocal === 'true' || appEnv === 'test'
    const testIssuer =
        synthetic && typeof env.POCKET_ID_TEST_ISSUER === 'string' && env.POCKET_ID_TEST_ISSUER
            ? env.POCKET_ID_TEST_ISSUER
            : synthetic
              ? process.env.POCKET_ID_TEST_ISSUER
              : undefined
    const issuer = normalizeIssuer(
        testIssuer ?? (typeof env.POCKET_ID_ISSUER === 'string' ? env.POCKET_ID_ISSUER : undefined),
    )
    const runtimeSiteUrl =
        typeof env.NUXT_PUBLIC_SITE_URL === 'string' && env.NUXT_PUBLIC_SITE_URL
            ? env.NUXT_PUBLIC_SITE_URL
            : process.env.NUXT_PUBLIC_SITE_URL || undefined
    const authBaseUrl = resolveAuthBaseUrl(requestOrigin, runtimeSiteUrl, synthetic, appEnv)
    const isHttps = authBaseUrl.startsWith('https://')
    const adminEmails = new Set(
        parseList(
            typeof env.POCKET_ID_ADMIN_EMAIL === 'string' ? env.POCKET_ID_ADMIN_EMAIL : undefined,
        ).map((email) => email.toLowerCase()),
    )
    const adminSubs = new Set(
        parseList(
            typeof env.POCKET_ID_ADMIN_SUB === 'string' ? env.POCKET_ID_ADMIN_SUB : undefined,
        ),
    )
    const clientId =
        typeof env.POCKET_ID_CLIENT_ID === 'string' && env.POCKET_ID_CLIENT_ID
            ? env.POCKET_ID_CLIENT_ID
            : 'offline-schema-client'
    const clientSecret = readSecretValue(env.POCKET_ID_CLIENT_SECRET)

    const trustedOrigins = Array.from(
        new Set([
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3100',
            'http://127.0.0.1:3100',
            'https://liry24.com',
            'https://dev-liry24-com.liry.workers.dev',
            authBaseUrl,
        ]),
    )

    return {
        appName: 'liry24',
        baseURL: authBaseUrl,
        database: authDatabase(),
        trustedOrigins,
        disabledPaths: ['/sign-in/username', '/link-social', '/unlink-account'],
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
                            if (adminEmails.has(email)) {
                                return { data: { ...user, role: 'admin' } }
                            }
                            if (adminSubs.size === 0) {
                                return false
                            }
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
                        ) {
                            return false
                        }
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
            cookiePrefix: 'liry24-pocket',
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

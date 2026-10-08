import { passkey } from '@better-auth/passkey'

import { jwt, lastLoginMethod } from '#better-auth/plugins'
import { defineServerAuth } from '#nuxtjs/better-auth/config'

import {
    isPreviewGitHubAccountAdmin,
    validatePreviewIdentity,
} from './utils/previewAuthorization.js'

export default defineServerAuth(() => {
    const isPreview = process.env.APP_ENV === 'preview'
    return {
        appName: 'liry24',

        trustedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3100',
            'http://127.0.0.1:3100',
            'https://liry24.com',
            ...(isPreview && process.env.NUXT_PUBLIC_SITE_URL
                ? [process.env.NUXT_PUBLIC_SITE_URL]
                : []),
        ],

        account: {
            additionalFields: { issuer: { type: 'string', required: false, input: false } },
            storeStateStrategy: 'database',
            updateAccountOnSignIn: true,
            accountLinking: {
                enabled: true,
                trustedProviders: ['github'],
                allowDifferentEmails: true,
            },
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

        socialProviders: {
            github: {
                clientId: process.env.GITHUB_CLIENT_ID!,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
                mapProfileToUser: async (profile) => ({
                    email: profile.email,
                    username: profile.login,
                    displayUsername: profile.login,
                    name: profile.name,
                    image: profile.avatar_url,
                    emailVerified: true,
                }),
                disableSignUp: !isPreview && process.env.ALLOW_SIGNUP !== 'true',
            },
            ...(!isPreview
                ? {
                      vercel: {
                          clientId: process.env.VERCEL_CLIENT_ID!,
                          clientSecret: process.env.VERCEL_CLIENT_SECRET,
                          mapProfileToUser: async (profile) => ({
                              email: profile.email,
                              username: profile.preferred_username,
                              displayUsername: profile.preferred_username,
                              name: profile.name,
                              image: profile.picture,
                              emailVerified: true,
                          }),
                          disableSignUp: process.env.ALLOW_SIGNUP !== 'true',
                      },
                  }
                : {}),
        },

        plugins: [
            ...(!isPreview ? [passkey()] : []),
            lastLoginMethod(),
            jwt({
                schema: { jwks: { modelName: 'jwk' } },
                disableSettingJwtHeader: true,
                jwks: {
                    rotationInterval: 60 * 60 * 24 * 30,
                    gracePeriod: 60 * 60 * 24 * 30,
                },
            }),
        ],

        user: {
            validateUserInfo: validatePreviewIdentity,
            changeEmail: { enabled: false },
            deleteUser: { enabled: false },
        },

        databaseHooks: {
            user: {
                create: {
                    before: async (user, ctx) => {
                        // validateUserInfo has already checked the GitHub identity before this write.
                        if (isPreview) return { data: { ...user, role: 'admin' } }
                        const existingUser = await ctx?.context.adapter.findMany({
                            model: 'user',
                            limit: 1,
                        })
                        return existingUser?.length
                            ? { data: user }
                            : { data: { ...user, role: 'admin' } }
                    },
                },
            },
            session: {
                create: {
                    before: async (session, ctx) => {
                        if (!isPreview) return
                        const accounts = await ctx?.context.internalAdapter.findAccounts(
                            session.userId,
                        )
                        const githubAccount = accounts?.find(
                            (account) => account.providerId === 'github',
                        )
                        if (
                            !githubAccount ||
                            !(await isPreviewGitHubAccountAdmin(githubAccount.accountId))
                        )
                            return false
                    },
                },
            },
        },

        advanced: {
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
    }
})

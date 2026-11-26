import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { useRuntimeConfig } from 'nuxt/server'

import { localAdminUserId } from '../../shared/utils/localAdminIdentity.js'

const localAdminEmail = 'liry24-local-admin@example.invalid'

export function localAdminAuth(origin: string) {
    if (!import.meta.dev) return

    const config = useRuntimeConfig().localAdmin
    if (!config.origin || !config.secret) return

    const target = new URL(origin)
    const listener = new URL(config.origin)
    if (
        target.protocol === listener.protocol &&
        target.port === listener.port &&
        (target.hostname === listener.hostname || target.hostname === 'localhost')
    )
        return config
}

export const localAdminPlugin = {
    id: 'liry24-local-admin',
    endpoints: {
        signInLocalAdmin: createAuthEndpoint.serverOnly({ method: 'POST' }, async (ctx) => {
            const { adapter, internalAdapter } = ctx.context
            const findUser = () => internalAdapter.findUserById(localAdminUserId)
            let user = await findUser()
            if (!user) {
                const now = new Date()
                try {
                    await adapter.create({
                        model: 'user',
                        data: {
                            id: localAdminUserId,
                            email: localAdminEmail,
                            emailVerified: true,
                            name: 'Local Administrator',
                            role: 'admin',
                            createdAt: now,
                            updatedAt: now,
                        },
                        forceAllowId: true,
                    })
                } catch (error) {
                    user = await findUser()
                    if (!user) throw error
                }
                user ??= await findUser()
            }
            if (
                !user ||
                user.email !== localAdminEmail ||
                !('role' in user) ||
                user.role !== 'admin'
            )
                throw new APIError('FORBIDDEN', { message: 'Local administrator is unavailable.' })

            const session = await internalAdapter.createSession(user.id)
            if (!session) {
                throw new APIError('INTERNAL_SERVER_ERROR', {
                    message: 'Could not create session.',
                })
            }
            await setSessionCookie(ctx, { session, user })
            return new Response(null, { status: 204 })
        }),
    },
}

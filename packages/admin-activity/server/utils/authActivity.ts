import type { BetterAuthPlugin } from 'better-auth'

import { recordAdminActivity } from './adminActivity.js'

const revocationPaths = new Set([
    '/revoke-session',
    '/revoke-sessions',
    '/revoke-other-sessions',
    '/admin/revoke-user-session',
    '/admin/revoke-user-sessions',
    '/admin/ban-user',
])
const profilePaths = new Set([
    '/update-user',
    '/admin/update-user',
    '/admin/set-role',
    '/admin/ban-user',
    '/admin/unban-user',
])
export const authActivity = {
    id: 'admin-activity',
    schema: {
        adminEvent: {
            fields: {
                actorId: { type: 'string', input: false },
                action: { type: 'string', input: false },
                targetId: { type: 'string', input: false },
                model: { type: 'string', required: false, input: false },
                label: { type: 'string', required: false, input: false },
                createdAt: { type: 'date', input: false },
            },
            indexes: [{ name: 'admin_events_actor_time', fields: ['actorId', 'createdAt'] }],
        },
    },
    init() {
        return {
            options: {
                databaseHooks: {
                    user: {
                        create: {
                            after: async (user) => {
                                await recordAdminActivity({
                                    actorId: user.id,
                                    action: 'account.create',
                                    targetId: user.id,
                                })
                            },
                        },
                        update: {
                            after: async (user, ctx) => {
                                if (!ctx?.path || !profilePaths.has(ctx.path)) return
                                await recordAdminActivity({
                                    actorId: ctx.context.session?.user.id ?? user.id,
                                    action: 'account.update',
                                    targetId: user.id,
                                    label: user.name,
                                })
                            },
                        },
                    },
                    session: {
                        create: {
                            after: async (session) => {
                                await recordAdminActivity({
                                    actorId: session.userId,
                                    action: 'session.create',
                                    targetId: session.id,
                                })
                            },
                        },
                        delete: {
                            after: async (session, ctx) => {
                                const action =
                                    ctx?.path === '/sign-out'
                                        ? 'session.logout'
                                        : ctx?.path && revocationPaths.has(ctx.path)
                                          ? 'session.revoke'
                                          : null
                                if (!action) return
                                await recordAdminActivity({
                                    actorId: ctx?.context.session?.user.id ?? session.userId,
                                    action,
                                    targetId: session.id,
                                })
                            },
                        },
                    },
                    account: {
                        create: {
                            after: async (account) => {
                                await recordAdminActivity({
                                    actorId: account.userId,
                                    action: 'provider.link',
                                    targetId: account.id,
                                    label: account.providerId,
                                })
                            },
                        },
                        delete: {
                            after: async (account, ctx) => {
                                if (ctx?.path !== '/unlink-account') return
                                await recordAdminActivity({
                                    actorId: account.userId,
                                    action: 'provider.unlink',
                                    targetId: account.id,
                                    label: account.providerId,
                                })
                            },
                        },
                    },
                },
            },
        }
    },
} satisfies BetterAuthPlugin

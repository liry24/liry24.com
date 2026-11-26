import type { RequestEvent } from 'nuxt/server'

export function isAdminUser(user: { role?: unknown } | null | undefined) {
    return user?.role === 'admin'
}

export async function getAppSession(event: RequestEvent) {
    return await useAuth(event.req).api.getSession({ headers: event.req.headers })
}

export async function requireAdminSession(event: RequestEvent) {
    const session = await getAppSession(event)
    if (!session?.user) throw createError({ status: 401, statusText: 'Sign in required' })

    if (!isAdminUser(session.user))
        throw createError({ status: 403, statusText: 'Administrator role required' })

    return session
}

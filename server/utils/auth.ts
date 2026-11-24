import type { RequestEvent } from 'nuxt/server'
import { createError } from 'nuxt/server'
import { useAuth } from 'vite-hub/auth/server'

export interface AppSessionUser {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
}

export function isAdminUser(user: AppSessionUser | { role?: unknown } | null | undefined) {
    return Boolean(user && typeof user === 'object' && user.role === 'admin')
}

export async function getAppSession(event: RequestEvent) {
    return await useAuth(event.req).api.getSession({ headers: event.req.headers })
}

export async function requireAdminSession(event: RequestEvent) {
    const session = await getAppSession(event)
    if (!session?.user) {
        throw createError({ status: 401, statusText: 'Sign in required' })
    }
    if (!isAdminUser(session.user)) {
        throw createError({ status: 403, statusText: 'Administrator role required' })
    }
    return session
}

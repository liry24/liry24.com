import { createError } from 'nuxt/server'

import { auth } from '../../auth'

export async function requireUserSession(request: Request, options?: { user?: { role: string } }) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) throw createError({ status: 401, statusText: 'Sign in' })
    if (options?.user?.role && session.user.role !== options.user.role)
        throw createError({ status: 403, statusText: 'Admin required' })
    return session
}

export function serverAuth(_request: Request) {
    return auth
}

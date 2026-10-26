import { createError } from 'nuxt/server'

import { auth } from '../../auth'

export async function requireUserSession(request: Request, options?: { user?: { role: string } }) {
    const role = request.headers.get('x-fixture-role')
    if (!role) throw createError({ status: 401, statusText: 'Sign in' })
    if (options?.user?.role && role !== options.user.role)
        throw createError({ status: 403, statusText: 'Admin required' })
    return { user: { id: request.headers.get('x-fixture-user') || 'synthetic-admin', role } }
}

export function serverAuth(request: Request) {
    return {
        api: {
            userHasPermission: ({ body }: { body: { permissions: Record<string, string[]> } }) =>
                auth.api.userHasPermission({
                    body: { ...body, role: request.headers.get('x-fixture-role') || 'user' },
                }),
        },
    }
}

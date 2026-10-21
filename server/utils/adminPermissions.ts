import { getNitroRequest } from 'liti/nuxt/server'
import { createError, type RequestEvent } from 'nuxt/server'

export async function requireAdminPermission(
    event: RequestEvent,
    permissions: Record<string, string[]>,
) {
    event.res.headers.set('Cache-Control', 'private, no-store')
    const request = getNitroRequest(event)
    const session = await requireUserSession(request)
    const result = await serverAuth(request).api.userHasPermission({
        headers: request.headers,
        body: { permissions },
    })
    if (!result.success) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    return session
}

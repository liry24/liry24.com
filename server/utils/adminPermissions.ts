import { createError, type RequestEvent } from 'nuxt/server'

export async function requireAdminPermission(
    event: RequestEvent,
    permissions: Record<string, string[]>,
) {
    event.res.headers.set('Cache-Control', 'private, no-store')
    const request = event.req
    const session = await requireAppSession(request)
    const result = await getAppAuth(request).api.userHasPermission({
        headers: request.headers,
        body: { permissions },
    })
    if (!result.success) throw createError({ status: 403, statusText: 'Access denied' })
    return session
}

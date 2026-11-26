export default defineNuxtRouteMiddleware(async (to) => {
    to.meta.pageTransition = false
    const signInError = to.query[pocketIdErrorParam]
    if (signInError !== undefined) {
        if (import.meta.client && useNuxtApp().isHydrating && useError().value) {
            return
        }
        const unavailable = signInError === 'unavailable'
        throw createError({
            status: unavailable ? 503 : 403,
            statusText: unavailable
                ? 'Could not start Pocket ID sign-in'
                : 'Could not sign in with Pocket ID',
            data: { retryAdminPath: pocketIdRetryPath(to.fullPath) },
        })
    }
    if (import.meta.server) {
        return
    }
    const request = useRequestFetch()
    const session = await request<{ user?: { id: string; role?: string | null } } | null>(
        '/api/auth/get-session',
    )
    if (!session?.user) {
        return navigateTo(to.fullPath, { external: true })
    }
    if (session.user.role !== 'admin') {
        throw createError({ status: 403, statusText: 'Access denied' })
    }
})

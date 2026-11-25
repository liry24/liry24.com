export default defineNuxtRouteMiddleware(async (to) => {
    to.meta.pageTransition = false
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

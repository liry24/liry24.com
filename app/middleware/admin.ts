export default defineNuxtRouteMiddleware(async (to) => {
    to.meta.pageTransition = false
    const request = useRequestFetch()
    const session = await request<{ user?: { id: string; role?: string | null } } | null>(
        '/api/auth/get-session',
    )
    if (!session?.user) {
        return navigateTo(
            {
                path: '/login',
                query: { redirect: to.fullPath },
            },
            { redirectCode: 302 },
        )
    }
    if (session.user.role !== 'admin') {
        throw createError({ status: 403, statusText: 'Access denied' })
    }
})

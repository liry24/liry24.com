export default defineNuxtRouteMiddleware(async (to) => {
    to.meta.pageTransition = false
    const request = useRequestFetch()
    const session = await request<{ user?: { id: string } } | null>('/api/auth/get-session')
    if (!session?.user) return navigateTo('/login', { redirectCode: 302 })
    const result = await request<{ success: boolean }>('/api/auth/admin/has-permission', {
        method: 'POST',
        headers: import.meta.server ? { origin: useRequestURL().origin } : undefined,
        body: { permissions: { adminPanel: ['access'] } },
    })
    if (!result.success) throw createError({ status: 403, statusText: 'Access denied' })
})

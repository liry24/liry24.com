export default defineNuxtRouteMiddleware(async (to) => {
    to.meta.pageTransition = false
    const result = await useRequestFetch()<{ success: boolean }>('/api/auth/admin/has-permission', {
        method: 'POST',
        headers: import.meta.server ? { origin: useRequestURL().origin } : undefined,
        body: { permissions: { adminPanel: ['access'] } },
    })
    if (!result.success) throw createError({ status: 403, statusText: 'Access denied' })
})

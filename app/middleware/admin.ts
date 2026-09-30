export default defineNuxtRouteMiddleware(async () => {
    const { fetchSession, ready, user } = useUserSession()
    if (!ready.value) await fetchSession()
    if (user.value?.role !== 'admin')
        throw createError({ statusCode: 404, statusMessage: 'Page not found' })
})

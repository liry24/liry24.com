export default defineNuxtRouteMiddleware(async (to) => {
    const { session } = await useAuth()

    if (!session.value || session.value.user.role !== 'admin') {
        if (to.fullPath !== '/login') return navigateTo('/login')
    } else {
        if (to.fullPath === '/login') return navigateTo('/')
    }

    to.meta.pageTransition = false
})

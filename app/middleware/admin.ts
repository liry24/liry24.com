export default defineNuxtRouteMiddleware(async (to) => {
    to.meta.pageTransition = false
    const signInError = to.query[pocketIdErrorParam]
    if (signInError !== undefined) {
        if (import.meta.client && useNuxtApp().isHydrating && useError().value) return

        const unavailable = signInError === 'unavailable'
        throw createError({
            status: unavailable ? 503 : 403,
            statusText: unavailable
                ? 'Could not start Pocket ID sign-in'
                : 'Could not sign in with Pocket ID',
            data: { retryAdminPath: pocketIdRetryPath(to.fullPath) },
        })
    }
    const verifiedPath = useState('admin-ssr-path', () => '')
    if (import.meta.server) {
        // The Nitro sign-in middleware has already authorized this request.
        verifiedPath.value = to.path
        return
    }

    const nuxt = useNuxtApp()
    const verification = useAdminSessionVerification()
    if (
        nuxt.isHydrating &&
        nuxt.payload.serverRendered &&
        !useError().value &&
        verifiedPath.value === to.path
    ) {
        verifiedPath.value = ''
        verification.update(true)
        return
    }
    if (verification.verified) return

    const { data: session, error } = await authClient.getSession()
    verification.update(!error && session?.user.role === 'admin')
    if (error) {
        throw createError({
            status: error.status || 500,
            statusText: error.message || 'Could not verify session',
        })
    }
    if (!session?.user) return navigateTo(to.fullPath, { external: true })

    if (session.user.role !== 'admin')
        throw createError({ status: 403, statusText: 'Access denied' })
})

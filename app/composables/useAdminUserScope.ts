export function useAdminUserScope() {
    const nuxt = useNuxtApp()
    const { user, session } = useAppSession()
    const scope = computed(
        () => `${user.value?.id ?? ''}:${session.value?.id ?? ''}:${user.value?.role ?? ''}`,
    )
    watch(
        scope,
        () => nuxt.runWithContext(() => clearNuxtData((key) => key.startsWith('admin-'))),
        { flush: 'sync' },
    )
    return scope
}

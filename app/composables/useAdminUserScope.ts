export function useAdminUserScope() {
    const { user, session } = useUserSession()
    const scope = computed(
        () => `${user.value?.id ?? ''}:${session.value?.id ?? ''}:${user.value?.role ?? ''}`,
    )
    watch(scope, () => clearNuxtData((key) => key.startsWith('admin-users:')), { flush: 'sync' })
    return scope
}

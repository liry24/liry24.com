export function useAdminPermissions() {
    const scope = useAdminUserScope()
    const request = useRequestFetch()
    const headers = import.meta.server ? { origin: useRequestURL().origin } : undefined
    return useAsyncData(
        computed(() => `admin-users:${scope.value}:permissions`),
        async () => {
            const [users, compose] = await Promise.all([
                request<{ success: boolean }>('/api/auth/admin/has-permission', {
                    method: 'POST',
                    headers,
                    body: { permissions: { user: ['list'] } },
                }),
                request<{ success: boolean }>('/api/auth/admin/has-permission', {
                    method: 'POST',
                    headers,
                    body: { permissions: { adminPanel: ['compose'] } },
                }),
            ])
            return { users: users.success, compose: compose.success }
        },
    )
}

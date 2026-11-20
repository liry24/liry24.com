export function useAdminPermissions() {
    const scope = useAdminUserScope()
    const request = useRequestFetch()
    const nuxtApp = useNuxtApp()
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
        nuxtApp.ssrContext
            ? {
                  getCachedData(key, nuxtApp, context) {
                      if (nuxtApp.isHydrating) return nuxtApp.payload.data[key]
                      if (context.cause === 'refresh:manual' || context.cause === 'refresh:hook')
                          return
                      if (
                          nuxtApp.ssrContext &&
                          context.cause === 'initial' &&
                          !nuxtApp.payload._errors[key]
                      )
                          return nuxtApp.payload.data[key]
                      return nuxtApp.static.data[key]
                  },
              }
            : undefined,
    )
}

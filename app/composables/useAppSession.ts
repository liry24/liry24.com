import { authClient as client, useUserSession } from 'vite-hub/auth/vue'

export function useAppSession() {
    const nuxt = useNuxtApp()
    const native = useUserSession()
    const isAdmin = computed(() => native.user.value?.role === 'admin')

    return {
        load: async () => {
            if (!native.ready.value) {
                await native.refresh()
            }
        },
        user: native.user,
        session: native.session,
        loggedIn: native.loggedIn,
        pending: native.pending,
        ready: native.ready,
        isAdmin,
        refresh: async () => {
            await native.refresh()
        },
        signOut: async () => {
            const result = await client.signOut()
            if (result.error) {
                throw new Error(result.error.message || 'Could not sign out.')
            }
            await nuxt.runWithContext(() => clearNuxtData((key) => key.startsWith('admin-')))
            await native.refresh()
            await nuxt.runWithContext(() => navigateTo('/login'))
        },
    }
}

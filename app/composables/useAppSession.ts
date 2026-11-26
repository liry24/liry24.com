import { authClient as client } from 'vite-hub/auth/vue'

export const useAppSession = () => {
    const nuxt = useNuxtApp()
    const native = useUserSession()
    const isLocalAdmin = computed(
        () => import.meta.dev && native.user.value?.id === localAdminUserId,
    )

    return {
        load: async () => {
            if (!native.ready.value) await native.refresh()
        },
        user: native.user,
        session: native.session,
        isLocalAdmin,
        signOut: async () => {
            const result = await client.signOut()
            if (result.error) throw new Error(result.error.message || 'Could not sign out.')

            await nuxt.runWithContext(() => clearNuxtData((key) => key.startsWith('admin-')))
            await native.refresh()
            await nuxt.runWithContext(() => navigateTo('/'))
        },
    }
}

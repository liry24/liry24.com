import { authClient as client } from 'vite-hub/auth/vue'

let adminVerifiedUntil = 0

export function isAdminSessionVerified() {
    return Date.now() < adminVerifiedUntil
}

export function setAdminSessionVerified(isAdmin: boolean) {
    if (import.meta.client) adminVerifiedUntil = isAdmin ? Date.now() + 30_000 : 0
}

export const useAppSession = () => {
    const nuxt = useNuxtApp()
    const native = useUserSession()
    const isLocalAdmin = computed(
        () => import.meta.dev && native.user.value?.id === localAdminUserId,
    )

    return {
        load: async () => {
            if (native.ready.value) return

            const current = await native.refresh()
            setAdminSessionVerified(!native.error.value && current?.user.role === 'admin')
        },
        user: native.user,
        session: native.session,
        isLocalAdmin,
        signOut: async () => {
            adminVerifiedUntil = 0
            const result = await client.signOut().finally(() => {
                adminVerifiedUntil = 0
            })
            if (result.error) throw new Error(result.error.message || 'Could not sign out.')

            await nuxt.runWithContext(() => clearNuxtData((key) => key.startsWith('admin-')))
            await native.refresh()
            await nuxt.runWithContext(() => navigateTo('/'))
        },
    }
}

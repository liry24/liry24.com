import { authClient as client } from 'vite-hub/auth/vue'

let adminSessionCache: { verifiedUntil: number } | undefined = { verifiedUntil: 0 }

export function useAdminSessionVerification() {
    const cache = adminSessionCache
    return {
        verified: cache !== undefined && Date.now() < cache.verifiedUntil,
        update(isAdmin: boolean) {
            if (import.meta.client && cache)
                cache.verifiedUntil = isAdmin ? Date.now() + 30_000 : 0
        },
    }
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

            const verification = useAdminSessionVerification()
            const current = await native.refresh()
            verification.update(!native.error.value && current?.user.role === 'admin')
        },
        user: native.user,
        session: native.session,
        isLocalAdmin,
        signOut: async () => {
            adminSessionCache = undefined
            const result = await client.signOut().finally(() => {
                adminSessionCache = { verifiedUntil: 0 }
            })
            if (result.error) throw new Error(result.error.message || 'Could not sign out.')

            await nuxt.runWithContext(() => clearNuxtData((key) => key.startsWith('admin-')))
            await native.refresh()
            await nuxt.runWithContext(() => navigateTo('/'))
        },
    }
}

import { useUserSession } from 'vite-hub/auth/vue'

export function useAppSession() {
    const nuxt = useNuxtApp()
    const native = useUserSession(authClient)
    type Session = typeof authClient.$Infer.Session
    const state = useState<Session | null>('app:session', () => null)
    const request = useRequestFetch()
    const resource = useAsyncData('app:session:request', async () => {
        state.value = await request<Session | null>('/api/auth/get-session')
        return { loaded: true }
    })
    watch(
        [native.ready, native.data],
        ([ready, data]) => {
            if (ready) state.value = data
        },
        { immediate: true },
    )
    const refresh = async () => {
        await native.refresh()
        await resource.refresh()
    }
    return {
        load: async () => {
            await resource
            if (resource.error.value) throw resource.error.value
        },
        user: computed(() => state.value?.user ?? null),
        session: computed(() => state.value?.session ?? null),
        loggedIn: computed(() => Boolean(state.value)),
        refresh,
        signOut: async () => {
            const result = await authClient.signOut()
            if (result.error) throw result.error
            state.value = null
            nuxt.runWithContext(() =>
                clearNuxtData((key) => key.startsWith('admin-') || key.startsWith('liti:private:')),
            )
            await nuxt.runWithContext(() => navigateTo('/'))
        },
    }
}

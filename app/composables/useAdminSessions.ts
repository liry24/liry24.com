import type { Session } from 'better-auth'

export const useAdminSessions = () => {
    const { session, signOut } = useAppSession()
    const sessions = ref<Array<Session>>([])
    const busy = ref(false)
    const failure = ref('')

    watch(
        () => session.value?.id,
        () => {
            sessions.value = []
            failure.value = ''
        },
        { flush: 'sync' },
    )

    async function run(token?: string, all = false) {
        if (busy.value) return

        const sessionId = session.value?.id
        busy.value = true
        failure.value = ''

        try {
            if (all) {
                const result = await authClient.revokeOtherSessions()
                if (result.error)
                    throw new Error(result.error.message || 'Could not revoke sessions.')
            } else if (token) {
                const result = await authClient.revokeSession({ token })
                if (result.error)
                    throw new Error(result.error.message || 'Could not revoke session.')
            }
            const result = await authClient.listSessions()
            if (result.error) throw new Error(result.error.message || 'Could not list sessions.')

            if (sessionId === session.value?.id) sessions.value = result.data ?? []
        } catch {
            if (sessionId === session.value?.id)
                failure.value = 'Could not update sessions. Please try again.'
        } finally {
            busy.value = false
        }
    }

    onMounted(() => {
        void run()
    })

    return {
        sessions,
        busy,
        failure,
        current: session,
        refresh: () => run(),
        revoke: (token: string) => run(token),
        revokeOthers: () => run(undefined, true),
        signOut,
    }
}

import type { Session } from 'better-auth'

export const useAdminSessions = () => {
    const client = authClient
    const { user, session, signOut } = useAppSession()
    const sessions = ref<Array<Session>>([])
    const busy = ref(false)
    const failure = ref('')
    const owner = computed(() => `${user.value?.id ?? ''}:${session.value?.id ?? ''}`)

    watch(
        owner,
        () => {
            sessions.value = []
            failure.value = ''
        },
        { flush: 'sync' },
    )

    async function run(token?: string, all = false) {
        if (busy.value) return

        const scope = owner.value
        busy.value = true
        failure.value = ''

        try {
            if (all) {
                const result = await client.revokeOtherSessions()
                if (result.error)
                    throw new Error(result.error.message || 'Could not revoke sessions.')
            } else if (token) {
                const result = await client.revokeSession({ token })
                if (result.error)
                    throw new Error(result.error.message || 'Could not revoke session.')
            }
            const result = await client.listSessions()
            if (result.error) throw new Error(result.error.message || 'Could not list sessions.')

            if (scope === owner.value) sessions.value = result.data ?? []
        } catch {
            if (scope === owner.value)
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

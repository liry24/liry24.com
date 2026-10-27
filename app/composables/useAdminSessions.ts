import type { Session } from 'better-auth'

export function useAdminSessions() {
    const client = authClient
    const { user, session, signOut } = useAppSession()
    const sessions = ref<Session[]>([])
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
            if (!client) throw new Error('Authentication client is unavailable')
            if (token || all) {
                const result = all
                    ? await client.revokeOtherSessions()
                    : await client.revokeSession({ token: token! })
                if (result.error) throw result.error
            }
            const result = await client.listSessions()
            if (result.error) throw result.error
            if (scope === owner.value) sessions.value = result.data ?? []
        } catch {
            if (scope === owner.value)
                failure.value = 'Could not update sessions. Please try again.'
        } finally {
            busy.value = false
        }
    }
    onMounted(() => run())
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

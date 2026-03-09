import { passkeyClient } from '@better-auth/passkey/client'
import { adminClient, lastLoginMethodClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { withoutHost } from 'ufo'

export const authClient = createAuthClient({
    plugins: [twoFactorClient(), passkeyClient(), adminClient(), lastLoginMethodClient()],
})

type Session = typeof authClient.$Infer.Session

export const useAuth = () => {
    const globalSession = useState<Session | null | undefined>('auth:session', () => undefined)

    const getSession = async () => {
        if (globalSession.value !== undefined) return globalSession

        const headers = useRequestHeaders()
        const { data } = await authClient.useSession((url, options) =>
            useFetch(withoutHost(url), { ...options, dedupe: 'defer', headers })
        )

        globalSession.value = data.value
        return globalSession
    }

    const refreshSession = async () => {
        const headers = useRequestHeaders()
        const { data } = await authClient.useSession((url, options) =>
            useFetch(withoutHost(url), {
                ...options,
                dedupe: 'defer',
                credentials: 'include',
                headers,
            })
        )

        globalSession.value = data.value
        return globalSession
    }

    const signIn = {
        passkey: authClient.signIn.passkey,
        github: () => authClient.signIn.social({ provider: 'github', callbackURL: '/' }),
        vercel: () => authClient.signIn.social({ provider: 'vercel', callbackURL: '/' }),
    }

    const signOut = async () => {
        const result = await authClient.signOut()
        if (result.data?.success) navigateTo('/', { external: true })
    }

    return {
        client: authClient,
        session: globalSession,
        getSession,
        refreshSession,
        signIn,
        signOut,
    }
}

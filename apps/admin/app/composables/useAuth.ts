import { passkeyClient } from '@better-auth/passkey/client'
import { adminClient, lastLoginMethodClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { withoutHost } from 'ufo'

export const authClient = createAuthClient({
    plugins: [twoFactorClient(), passkeyClient(), adminClient(), lastLoginMethodClient()],
})

type Session = typeof authClient.$Infer.Session

export const _useAuth = () => {
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

    const returnObject = {
        client: authClient,
        session: globalSession,
        getSession,
        refreshSession,
        signIn,
        signOut,
    }

    const initPromise = Promise.all([getSession()]).then(() => returnObject)

    // Merge promise with return object (same pattern as Nuxt's useFetch/useAsyncData)
    const awaitableResult = Object.assign(initPromise, returnObject)

    // Make Promise methods enumerable
    Object.defineProperties(awaitableResult, {
        then: { enumerable: true, value: initPromise.then.bind(initPromise) },
        catch: { enumerable: true, value: initPromise.catch.bind(initPromise) },
        finally: { enumerable: true, value: initPromise.finally.bind(initPromise) },
    })

    return awaitableResult
}

export const useAuth = createSharedComposable(_useAuth)

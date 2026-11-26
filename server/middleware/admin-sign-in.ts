import { z } from 'zod'

const signInResult = z.object({ url: z.url({ protocol: /^https?$/u }) })
const localSessionParam = 'local-session'

export default defineEventHandler(async (event) => {
    if (!isAdminPath(event.url.pathname)) return

    event.res.headers.set('Cache-Control', 'private, no-store')
    const local = import.meta.dev && localAdminAuth(event.url.origin)
    const target = new URL(event.url)
    const localSessionAttempted = target.searchParams.has(localSessionParam)
    const pocketSignInFailed = target.searchParams.has(pocketIdErrorParam)
    if (localSessionAttempted) target.searchParams.delete(localSessionParam)

    const callbackURL = adminRedirect(target.pathname + target.search)
    const session = await getAppSession(event)
    if (session?.user) {
        if (!isAdminUser(session.user))
            throw createError({ status: 403, statusText: 'Access denied' })
        if (pocketSignInFailed) return sendRedirect(event, pocketIdRetryPath(callbackURL), 302)
        if (localSessionAttempted) return sendRedirect(event, callbackURL, 302)
        return
    }

    const purpose = `${event.req.headers.get('sec-purpose') ?? ''} ${event.req.headers.get('purpose') ?? ''}`
    if (event.req.method !== 'GET' || /prefetch/i.test(purpose))
        throw createError({ status: 401, statusText: 'Sign in required' })

    if (local) {
        const origin = event.req.headers.get('origin')
        const mode = event.req.headers.get('sec-fetch-mode')
        const site = event.req.headers.get('sec-fetch-site')
        if (
            localSessionAttempted ||
            (origin && origin !== event.url.origin) ||
            (mode && mode !== 'navigate') ||
            (site && site !== 'none' && site !== 'same-origin')
        )
            throw createError({ status: 401, statusText: 'Local sign-in required' })

        const response = await useAuth(event.req).api.signInLocalAdmin({
            headers: event.req.headers,
            asResponse: true,
        })
        if (!response.ok) return response

        for (const cookie of response.headers.getSetCookie())
            event.res.headers.append('Set-Cookie', cookie)

        target.searchParams.set(localSessionParam, '1')
        return sendRedirect(event, target.pathname + target.search, 302)
    }

    if (pocketSignInFailed) {
        // Let Nuxt render the sign-in error with the retry action.
        return
    }

    const errorTarget = new URL(callbackURL, event.url.origin)
    errorTarget.searchParams.set(pocketIdErrorParam, '1')
    const errorCallbackURL = errorTarget.pathname + errorTarget.search
    const headers = new Headers(event.req.headers)
    headers.set('origin', event.url.origin)
    headers.set('content-type', 'application/json')
    headers.set('accept', 'application/json')
    const auth = useAuth(event.req)
    const start = await auth.handler(
        new Request(new URL('/api/auth/sign-in/social', event.url), {
            method: 'POST',
            headers,
            body: JSON.stringify({ provider: 'pocket-id', callbackURL, errorCallbackURL }),
        }),
    )
    if (start.status === 429) return start

    const result = signInResult.safeParse(start.ok ? await start.json().catch(() => null) : null)
    for (const cookie of start.headers.getSetCookie())
        event.res.headers.append('Set-Cookie', cookie)

    if (!result.success) {
        errorTarget.searchParams.set(pocketIdErrorParam, 'unavailable')
        return sendRedirect(event, errorTarget.pathname + errorTarget.search, 302)
    }
    return sendRedirect(event, result.data.url, 302)
})

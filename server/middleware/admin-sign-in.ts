import { z } from 'zod'

const signInResult = z.object({ url: z.url({ protocol: /^https?$/u }) })

export default defineEventHandler(async (event) => {
    if (!isAdminPath(event.url.pathname)) {
        return
    }

    event.res.headers.set('Cache-Control', 'private, no-store')
    const session = await getAppSession(event)
    if (session?.user) {
        if (!isAdminUser(session.user)) {
            throw createError({ status: 403, statusText: 'Access denied' })
        }
        return
    }

    const purpose = `${event.req.headers.get('sec-purpose') ?? ''} ${event.req.headers.get('purpose') ?? ''}`
    if (event.req.method !== 'GET' || /prefetch/i.test(purpose)) {
        throw createError({ status: 401, statusText: 'Sign in required' })
    }

    const callbackURL = adminRedirect(event.url.pathname + event.url.search)
    const errorCallbackURL = `/login?${new URLSearchParams({ error: 'oauth', redirect: callbackURL })}`
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
    if (start.status === 429) {
        return start
    }
    const result = signInResult.safeParse(start.ok ? await start.json().catch(() => null) : null)
    for (const cookie of start.headers.getSetCookie()) {
        event.res.headers.append('Set-Cookie', cookie)
    }
    return sendRedirect(event, result.success ? result.data.url : errorCallbackURL, 302)
})

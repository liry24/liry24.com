import { createError } from 'nuxt/server'
import { getAuthForRequest } from 'vite-hub/auth/server'

export const getAppAuth = (request: Request) => getAuthForRequest(request)
export async function requireAppSession(request: Request) {
    const session = await getAppAuth(request).api.getSession({ headers: request.headers })
    if (!session) throw createError({ status: 401, statusText: 'Sign in required' })
    return session
}

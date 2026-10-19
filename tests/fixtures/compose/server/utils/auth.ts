import { createError } from 'nuxt/server'
export async function requireUserSession(request: Request) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    const role = request.headers.get('x-fixture-role')
    if (!role) throw createError({ statusCode: 401, message: 'Sign in' })
    if (role !== 'admin') throw createError({ statusCode: 403, message: 'Admin required' })
    return { user: { id: 'synthetic-admin', role } }
}

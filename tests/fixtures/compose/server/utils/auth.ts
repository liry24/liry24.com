import { betterAuth } from 'better-auth'
import { admin, createAccessControl } from 'better-auth/plugins'
import { createError } from 'nuxt/server'

const fixtureAccess = createAccessControl({
    ...adminAccess.statements,
    'liti:model:games': ['readDraft', 'create'],
} as const)
const auth = betterAuth({
    baseURL: 'http://localhost',
    secret: 'synthetic-permissions-secret-0123456789abcdef',
    plugins: [
        admin({
            ac: fixtureAccess,
            roles: {
                ...adminRoles,
                admin: fixtureAccess.newRole({
                    ...adminRoles.admin.statements,
                    'liti:model:games': ['readDraft', 'create'],
                }),
                gameReader: fixtureAccess.newRole({ 'liti:model:games': ['readDraft'] }),
                gameImporter: fixtureAccess.newRole({ 'liti:model:games': ['create'] }),
            },
        }),
    ],
})
export async function requireUserSession(request: Request) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    const role = request.headers.get('x-fixture-role')
    if (!role) throw createError({ statusCode: 401, message: 'Sign in' })
    return { user: { id: 'synthetic-admin', role } }
}

export function serverAuth(request: Request) {
    return {
        api: {
            userHasPermission: ({ body }: { body: { permissions: Record<string, string[]> } }) =>
                auth.api.userHasPermission({
                    body: { ...body, role: request.headers.get('x-fixture-role') || 'user' },
                }),
        },
    }
}

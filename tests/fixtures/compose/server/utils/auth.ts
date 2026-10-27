import { betterAuth } from 'better-auth'
import { admin, createAccessControl } from 'better-auth/plugins'
import { createError } from 'nuxt/server'

import { sqlite } from '../../../admin/database'
import { configureGameFixture } from '../../games'

sqlite
    .prepare(
        'INSERT OR IGNORE INTO liti_games (id, version, created_at, updated_at, igdbId, slug, name, metrics, "order") VALUES (?, 1, ?, ?, 1, ?, ?, ?, 0)',
    )
    .run(
        'igdb-1',
        '2026-10-28T00:00:00Z',
        '2026-10-28T00:00:00Z',
        'exact--igdb-slug',
        'Exact Game',
        '[]',
    )

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
export async function requireAppSession(request: Request) {
    configureGameFixture(request.headers.get('x-fixture-case'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    const role = request.headers.get('x-fixture-role')
    if (!role) throw createError({ status: 401, message: 'Sign in' })
    return {
        user: { id: 'synthetic-admin', role, scenario: request.headers.get('x-fixture-case') },
    }
}

export function getAppAuth(request: Request) {
    return {
        api: {
            userHasPermission: ({ body }: { body: { permissions: Record<string, string[]> } }) =>
                auth.api.userHasPermission({
                    body: { ...body, role: request.headers.get('x-fixture-role') || 'user' },
                }),
        },
    }
}

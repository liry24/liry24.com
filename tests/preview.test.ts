import { afterEach, expect, test, vi } from 'vitest'

import createAuthConfig from '../server/auth.config'
import {
    isPreviewGitHubAccountAdmin,
    validatePreviewIdentity,
} from '../server/utils/previewAuthorization'

test('Preview login fails closed and rechecks a GitHub account after permission changes', async () => {
    const previous = { mode: process.env.APP_ENV, token: process.env.PREVIEW_GITHUB_TOKEN }
    process.env.APP_ENV = 'dev'
    process.env.PREVIEW_GITHUB_TOKEN = 'test-only'
    let permission = 'admin'
    let returnedId = 42
    let status = 200
    const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
            async (input) =>
                new Response(
                    JSON.stringify(
                        String(input).endsWith('/user/42')
                            ? { id: 42, login: 'renamed-admin' }
                            : { permission, user: { id: returnedId } },
                    ),
                    { status },
                ),
        )
    const source = {
        method: 'oauth',
        oauth: { providerId: 'github', profile: { id: 42, login: 'admin' } },
    }
    try {
        expect(await validatePreviewIdentity({ source })).toBeUndefined()
        expect(await isPreviewGitHubAccountAdmin('42')).toBe(true)
        for (permission of ['write', 'maintain', 'read', 'unknown']) {
            expect(await validatePreviewIdentity({ source })).toHaveProperty(
                'error',
                'preview_access_denied',
            )
            expect(await isPreviewGitHubAccountAdmin('42')).toBe(false)
        }
        permission = 'admin'
        returnedId = 99
        expect(await validatePreviewIdentity({ source })).toHaveProperty('error')
        returnedId = 42
        status = 503
        expect(await isPreviewGitHubAccountAdmin('42')).toBe(false)
        status = 200
        expect(await validatePreviewIdentity({ source: { method: 'email' } })).toHaveProperty(
            'error',
        )
        expect(
            await validatePreviewIdentity({
                source: { ...source, oauth: { ...source.oauth, providerId: 'vercel' } },
            }),
        ).toHaveProperty('error')
        delete process.env.PREVIEW_GITHUB_TOKEN
        expect(await isPreviewGitHubAccountAdmin('42')).toBe(false)
        process.env.APP_ENV = 'production'
        expect(await validatePreviewIdentity({ source: { method: 'email' } })).toBeUndefined()
    } finally {
        fetchMock.mockRestore()
        if (previous.mode === undefined) delete process.env.APP_ENV
        else process.env.APP_ENV = previous.mode
        if (previous.token === undefined) delete process.env.PREVIEW_GITHUB_TOKEN
        else process.env.PREVIEW_GITHUB_TOKEN = previous.token
    }
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

test('Preview sessions check GitHub at login and refuse missing accounts or failed permission checks', async () => {
    vi.stubEnv('APP_ENV', 'dev')
    vi.stubEnv('PREVIEW_GITHUB_TOKEN', 'test-only')
    let permission = 'admin'
    let status = 200
    const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(
            async (input) =>
                new Response(
                    JSON.stringify(
                        String(input).endsWith('/user/42')
                            ? { id: 42, login: 'admin' }
                            : { permission, user: { id: 42 } },
                    ),
                    { status },
                ),
        )
    const config = createAuthConfig({} as never)
    const before = config.databaseHooks.session.create.before
    const findAccounts = vi.fn(async () => [{ providerId: 'github', accountId: '42' }])
    const context = { context: { internalAdapter: { findAccounts } } } as never
    const session = { userId: 'admin' } as never
    expect(Object.keys(config.socialProviders)).toEqual(['github'])
    expect(config.plugins.some((plugin) => plugin.id === 'passkey')).toBe(false)
    expect(config.user.validateUserInfo).toBe(validatePreviewIdentity)
    expect(await before(session, context)).toBeUndefined()
    expect(findAccounts).toHaveBeenCalledWith('admin')
    expect(fetcher).toHaveBeenCalledTimes(2)
    permission = 'write'
    expect(await before(session, context)).toBe(false)
    permission = 'admin'
    status = 503
    expect(await before(session, context)).toBe(false)
    findAccounts.mockResolvedValue([])
    fetcher.mockClear()
    expect(await before(session, context)).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
    vi.stubEnv('APP_ENV', 'production')
    const production = createAuthConfig({} as never)
    expect(await production.databaseHooks.session.create.before(session, context)).toBeUndefined()
    expect(fetcher).not.toHaveBeenCalled()
})

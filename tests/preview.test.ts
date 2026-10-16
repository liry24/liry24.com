import { expect, test, vi } from 'vitest'

import {
    isPreviewGitHubAccountAdmin,
    previewAuthorizationForRequest,
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

test('Preview authorization is shared only within one request and actor', async () => {
    const request = {}
    const check = vi.fn(async () => true)
    expect(
        await Promise.all([
            previewAuthorizationForRequest(request, 'admin', check),
            previewAuthorizationForRequest(request, 'admin', check),
        ]),
    ).toEqual([true, true])
    expect(check).toHaveBeenCalledTimes(1)
    check.mockResolvedValue(false)
    expect(await previewAuthorizationForRequest({}, 'admin', check)).toBe(false)
    expect(await previewAuthorizationForRequest(request, 'other', check)).toBe(false)
    expect(check).toHaveBeenCalledTimes(3)
})

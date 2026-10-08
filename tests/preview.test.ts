import { expect, test, vi } from 'vitest'

import { previewBindings, previewTarget } from '../scripts/preview-target.mjs'
import {
    isPreviewGitHubAccountAdmin,
    validatePreviewIdentity,
} from '../server/utils/previewAuthorization'

test('Preview names isolate branches and never select production', () => {
    expect(() => previewTarget('main')).toThrow()
    expect(() => previewTarget('refs/heads/dev')).toThrow()
    const targets = ['dev', 'feature/a', 'feature-a', 'DEV', '日本語'].map(previewTarget)
    expect(new Set(targets.map((target) => target.resourceName)).size).toBe(targets.length)
    for (const target of targets) {
        expect(target.resourceName).toMatch(/^liry24-com-p-[a-z0-9-]+$/)
        expect(target.resourceName.length).toBeLessThanOrEqual(63)
        expect(new URL(target.url).hostname).toBe(`${target.name}-liry24-com.liry.workers.dev`)
    }
    expect(previewTarget('dev')).toEqual(targets[0])
})

test('Wrangler Preview bindings use only the branch resources and public origin', () => {
    const target = previewTarget('feature/wrangler')
    const parameters = {
        siteURL: target.url,
        databaseId: '11111111-2222-3333-4444-555555555555',
        resourceName: target.resourceName,
    }
    const bindings = previewBindings(parameters)
    expect(bindings.d1_databases).toEqual([
        {
            binding: 'DB',
            database_id: parameters.databaseId,
            database_name: target.resourceName,
        },
    ])
    expect(bindings.r2_buckets).toEqual([{ binding: 'R2', bucket_name: target.resourceName }])
    expect(bindings.vars.APP_ENV).toBe('preview')
    expect(bindings.vars.NUXT_PUBLIC_PREVIEW).toBe('true')
    expect(bindings.vars.NUXT_PUBLIC_SITE_URL).toBe(target.url)
    expect(bindings).not.toHaveProperty('triggers')
    expect(bindings).not.toHaveProperty('routes')
    expect(bindings.vars).not.toHaveProperty('GITHUB_CLIENT_ID')
    expect(() => previewBindings({ ...parameters, siteURL: 'https://liry24.com' })).toThrow()
    expect(() => previewBindings({ ...parameters, resourceName: 'liry24-com' })).toThrow()
    expect(() =>
        previewBindings({ ...parameters, databaseId: '227d818f-cd40-4fca-9710-b57273be94ca' }),
    ).toThrow()
    expect(() => previewBindings({ ...parameters, databaseId: undefined })).toThrow()
})

test('Preview login fails closed and rechecks a GitHub account after permission changes', async () => {
    const previous = { mode: process.env.APP_ENV, token: process.env.PREVIEW_GITHUB_TOKEN }
    process.env.APP_ENV = 'preview'
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

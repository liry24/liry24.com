import { expect, test } from 'vitest'
import { z } from 'zod'

import { builtWorker } from '../helpers/builtWorker'
import { oidcProvider } from '../helpers/oidc'

const sessionPayloadSchema = z
    .object({
        user: z.object({
            id: z.string(),
            role: z.string(),
            email: z.string(),
        }),
    })
    .nullable()

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'Pocket ID enforces single-owner access and rejects legacy methods and invalid identities',
    async () => {
        const provider = await oidcProvider()
        const app = await builtWorker({
            secrets: {
                POCKET_ID_TEST_ISSUER: provider.issuer,
                POCKET_ID_ADMIN_EMAIL: 'owner@example.invalid',
                POCKET_ID_ADMIN_SUB: '',
            },
        })
        try {
            async function signIn() {
                const cookies = new Map<string, string>()
                function remember(response: { headers: { getSetCookie(): Array<string> } }) {
                    for (const value of response.headers.getSetCookie()) {
                        const pair = value.split(';')[0]
                        if (!pair) {
                            continue
                        }
                        const sep = pair.indexOf('=')
                        if (sep > 0) {
                            cookies.set(pair.slice(0, sep), pair)
                        }
                    }
                }

                const start = await app.server.fetch('/admin/works?view=list', {
                    redirect: 'manual',
                })
                expect(start.status, await start.clone().text()).toBe(302)
                expect(start.headers.get('cache-control')).toContain('no-store')
                remember(start)
                const authorization = new URL(start.headers.get('location') ?? '/', app.url)
                expect(authorization.origin).toBe(provider.issuer)
                expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')

                const login = await fetch(authorization, { redirect: 'manual' })
                expect(login.status).toBe(302)
                const location = login.headers.get('location')
                if (!location) {
                    throw new Error('Missing OIDC redirect location')
                }
                const callback = new URL(location)
                expect(callback.pathname).toBe('/api/auth/callback/pocket-id')
                const result = await app.server.fetch(callback.pathname + callback.search, {
                    headers: { cookie: [...cookies.values()].join('; ') },
                    redirect: 'manual',
                })
                remember(result)
                const cookie = [...cookies.values()].join('; ')
                const sessionResponse = await app.server.fetch('/api/auth/get-session', {
                    headers: { cookie },
                })
                const session = sessionPayloadSchema.parse(await sessionResponse.json())
                return { result, cookie, session }
            }

            provider.identity({
                sub: 'other-sub',
                email: 'stranger@example.invalid',
                email_verified: true,
                name: 'Stranger',
            })
            expect((await signIn()).session).toBeNull()

            provider.identity({
                sub: 'owner-sub',
                email: 'owner@example.invalid',
                email_verified: true,
                name: 'Owner',
            })
            const ownerSignIn = await signIn()
            const ownerDiagnostics = [
                `callbackStatus=${ownerSignIn.result.status}`,
                `callbackLocation=${ownerSignIn.result.headers.get('location') ?? 'none'}`,
                ...app.server
                    .getLogs()
                    .filter((entry) => entry.level === 'error')
                    .map((entry) => entry.message),
            ].join(' | ')
            expect(ownerSignIn.session?.user.role, ownerDiagnostics).toBe('admin')
            const callback = new URL(ownerSignIn.result.headers.get('location') ?? '/', app.url)
            expect(callback.pathname + callback.search).toBe('/admin/works?view=list')
            const ownerId = ownerSignIn.session?.user.id
            if (!ownerId) {
                throw new Error('Missing owner id')
            }
            expect((await signIn()).session?.user.id).toBe(ownerId)

            expect(
                (
                    await app.server.fetch('/api/admin/content/posts', {
                        headers: { cookie: ownerSignIn.cookie },
                    })
                ).status,
            ).toBe(200)

            provider.identity({
                sub: 'different-sub',
                email: 'owner@example.invalid',
                email_verified: true,
                name: 'Spoofed email user',
            })
            expect((await signIn()).session).toBeNull()

            provider.identity({
                sub: 'owner-sub',
                email: 'owner@example.invalid',
                email_verified: true,
                name: 'Owner',
            })
            await app.env.DB.prepare('UPDATE user SET banned = 1 WHERE id = ?').bind(ownerId).run()
            expect((await signIn()).session).toBeNull()
            await app.env.DB.prepare('UPDATE user SET banned = 0 WHERE id = ?').bind(ownerId).run()

            for (const invalid of ['nonce', 'issuer', 'audience', 'signature'] as const) {
                provider.invalid(invalid)
                expect((await signIn()).session, invalid).toBeNull()
            }
            provider.invalid(undefined)

            const oldCookie = ownerSignIn.cookie.replaceAll('liry24-pocket.', 'better-auth.')
            expect(
                await (
                    await app.server.fetch('/api/auth/get-session', {
                        headers: { cookie: oldCookie },
                    })
                ).json(),
            ).toBeNull()

            for (const path of [
                '/passkey/generate-authenticate-options',
                '/sign-in/username',
                '/link-social',
                '/unlink-account',
            ]) {
                const response = await app.server.fetch(`/api/auth${path}`, {
                    method: 'POST',
                    headers: { origin: app.url.origin, 'content-type': 'application/json' },
                    body: '{}',
                })
                expect(response.status).toBe(404)
            }
            for (const name of ['github', 'vercel']) {
                const response = await app.server.fetch('/api/auth/sign-in/social', {
                    method: 'POST',
                    headers: {
                        origin: app.url.origin,
                        'content-type': 'application/json',
                        'x-forwarded-for': '198.51.100.10',
                    },
                    body: JSON.stringify({ provider: name }),
                })
                expect(response.status).toBe(404)
            }
            expect(
                (
                    await app.server.fetch(
                        '/api/auth/callback/pocket-id?code=forged&state=forged',
                        { redirect: 'manual' },
                    )
                ).status,
            ).toBe(302)
        } finally {
            await app.close()
            await provider.close()
        }
    },
    120_000,
)

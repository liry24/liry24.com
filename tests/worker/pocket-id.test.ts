import { expect, test } from 'vitest'

import { builtWorker } from '../helpers/builtWorker'
import { oidcProvider } from '../helpers/oidc'

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'Pocket ID authenticates local users and rejects legacy methods and invalid identities',
    async () => {
        const provider = await oidcProvider()
        const app = await builtWorker({ POCKET_ID_TEST_ISSUER: provider.issuer })
        try {
            async function signIn() {
                const cookies = new Map<string, string>()
                function remember(response: Response) {
                    for (const value of response.headers.getSetCookie()) {
                        const pair = value.split(';')[0]!
                        cookies.set(pair.slice(0, pair.indexOf('=')), pair)
                    }
                }
                const start = await app.server.fetch('/api/auth/sign-in/social', {
                    method: 'POST',
                    headers: { origin: app.url.origin, 'content-type': 'application/json' },
                    body: JSON.stringify({
                        provider: 'pocket-id',
                        callbackURL: '/auth/complete',
                        errorCallbackURL: '/login',
                    }),
                })
                expect(start.status, await start.clone().text()).toBe(200)
                remember(start)
                const { url } = (await start.json()) as { url: string }
                const authorization = new URL(url)
                expect(authorization.origin).toBe(provider.issuer)
                expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
                const login = await fetch(url, { redirect: 'manual' })
                expect(login.status).toBe(302)
                const callback = new URL(login.headers.get('location')!)
                const result = await app.server.fetch(callback.pathname + callback.search, {
                    headers: { cookie: [...cookies.values()].join('; ') },
                    redirect: 'manual',
                })
                remember(result)
                const cookie = [...cookies.values()].join('; ')
                const session = (await (
                    await app.server.fetch('/api/auth/get-session', { headers: { cookie } })
                ).json()) as { user: { id: string; role: string } } | null
                return { result, cookie, session }
            }

            const first = await signIn()
            expect(first.session?.user.role).toBe('user')
            const firstId = first.session!.user.id
            expect((await signIn()).session?.user.id).toBe(firstId)
            expect(
                (await app.server.fetch('/api/admin/users', { headers: { cookie: first.cookie } }))
                    .status,
            ).toBe(403)

            await app.session('existing-admin')
            await app.env.DB.prepare(
                'INSERT INTO account (id, user_id, provider_id, account_id, issuer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
                .bind(
                    'existing-pocket',
                    'existing-admin',
                    'pocket-id',
                    'existing-sub',
                    provider.issuer,
                    Date.now(),
                    Date.now(),
                )
                .run()
            provider.identity({
                sub: 'existing-sub',
                email: 'existing-admin@example.invalid',
                email_verified: true,
                name: 'Existing admin',
            })
            const admin = await signIn()
            expect(admin.session?.user).toMatchObject({ id: 'existing-admin', role: 'admin' })

            provider.identity({
                sub: 'different-sub',
                email: 'existing-admin@example.invalid',
                email_verified: true,
                name: 'Different user',
            })
            expect((await signIn()).session).toBeNull()
            provider.identity({
                sub: 'existing-sub',
                email: 'existing-admin@example.invalid',
                email_verified: true,
                name: 'Existing admin',
            })
            await app.env.DB.prepare('UPDATE user SET banned = 1 WHERE id = ?')
                .bind('existing-admin')
                .run()
            expect((await signIn()).session).toBeNull()
            await app.env.DB.prepare('UPDATE user SET banned = 0 WHERE id = ?')
                .bind('existing-admin')
                .run()

            for (const invalid of ['nonce', 'issuer', 'audience', 'signature'] as const) {
                provider.invalid(invalid)
                expect((await signIn()).session, invalid).toBeNull()
            }
            const oldCookie = admin.cookie.replaceAll('liry24-pocket.', 'better-auth.')
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
                const response = await app.server.fetch('/api/auth' + path, {
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
    120000,
)

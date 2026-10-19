import { fileURLToPath } from 'node:url'

import { fetch, setup } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'

await setup({
    rootDir: fileURLToPath(new URL('./fixtures/admin', import.meta.url)),
    dev: false,
    server: true,
    browser: false,
    setupTimeout: 120_000,
})
const fixture = async (body: unknown) =>
    (
        await fetch('/api/fixture', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
    ).json()
const read = (path: string, role = 'admin', userId = 'synthetic-admin') =>
    fetch(`/api/admin/users${path}`, {
        headers: { 'x-fixture-role': role, 'x-fixture-user': userId },
    })

test('admin-only projections paginate without returning account secrets', async () => {
    await fixture({ action: 'seed' })
    for (const path of ['', '/name-0', '/name-0/activity']) {
        expect((await read(path, '')).status).toBe(401)
        expect((await read(path, 'user')).status).toBe(403)
    }
    const response = await read('')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const first = await response.json()
    const next = await (await read('?offset=20')).json()
    expect(first.total).toBe(23)
    expect(first.items).toHaveLength(20)
    expect(next.items).toHaveLength(3)
    expect(new Set([...first.items, ...next.items].map((item) => item.id)).size).toBe(23)
    const detail = await (await read('/NAME-0')).json()
    expect(detail).toMatchObject({ user: { id: 'user-00' }, providers: ['github'] })
    expect(JSON.stringify(detail)).not.toMatch(/SECRET|token|accountId|password/)
    expect((await read('/~user-22')).status).toBe(200)
    expect((await read('/~user-00')).status).toBe(404)
    expect((await read('/missing')).status).toBe(404)
    for (const path of ['?limit=101', '?offset=-1', '?limit=x', '/name-0/activity?cursor=garbage'])
        expect((await read(path)).status).toBe(400)
}, 20_000)
test('same-time activity uses ID cursor without duplicate or omitted rows', async () => {
    const first = await (await read('/name-0/activity')).json()
    expect(first.items).toHaveLength(20)
    const second = await (
        await read(`/name-0/activity?cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json()
    expect(second.items).toHaveLength(3)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(23)
    expect(first.items[0]).toMatchObject({ actorId: 'user-00', label: 'Retained title' })
})

test('native access control grants own and other activity separately, including pagination', async () => {
    const own = await read('/name-1/activity?limit=1', 'user', 'user-01')
    expect(own.status).toBe(200)
    expect(own.headers.get('cache-control')).toBe('private, no-store')
    const first = await own.json()
    expect(first.items).toHaveLength(1)
    expect(first.items[0]).toMatchObject({ actorId: 'user-01', label: 'PRIVATE ACCOUNT ACTIVITY' })
    expect(first.nextCursor).toBeTruthy()
    const nextPath = `/name-1/activity?cursor=${encodeURIComponent(first.nextCursor)}`
    const remaining = await (await read(nextPath, 'user', 'user-01')).json()
    expect(remaining.items).toHaveLength(8)
    expect(remaining.nextCursor).toBeNull()
    for (const role of ['admin', 'editor,admin']) {
        const allowed = await read('/name-1/activity', role)
        expect(allowed.status).toBe(200)
        expect((await allowed.json()).items).toHaveLength(9)
    }
    for (const role of ['user', 'editor', 'superadmin', 'admin-reader']) {
        for (const path of ['/name-1/activity?actorId=user-01', nextPath]) {
            const denied = await read(path, role, 'user-00')
            expect(denied.status).toBe(403)
            expect(await denied.text()).not.toMatch(
                /PRIVATE ACCOUNT ACTIVITY|private-target|nextCursor/,
            )
        }
    }
    expect((await read('/name-1/activity', '', 'user-01')).status).toBe(401)
    expect((await read('/~user-22/activity', 'user', 'user-22')).status).toBe(200)
    expect((await read('/~user-22/activity', 'user', 'user-01')).status).toBe(403)
    for (const path of ['', '/name-1']) expect((await read(path, 'reader')).status).toBe(200)
    expect((await read('/name-1/activity', 'reader', 'user-01')).status).toBe(200)
    expect((await read('/name-1/activity', 'reader')).status).toBe(403)
    expect((await read('/name-1/activity', 'auditor')).status).toBe(200)
    for (const path of ['', '/name-1']) expect((await read(path, 'auditor')).status).toBe(403)
})
test('native auth hooks log successful actions and storage failure cannot fail authentication', async () => {
    const call = (path: string, body: unknown, cookie?: string) =>
        fixture({ action: 'auth', path, body, cookie })
    const signup = await call('/sign-up/email', {
        email: 'auth@example.invalid',
        password: 'synthetic-password',
        name: 'Auth',
        username: 'Git-Hub',
    })
    expect(signup.status).toBe(200)
    expect(signup.body.user.username).toBe('git-hub')
    const cookie = signup.cookies.map((item: string) => item.split(';')[0]).join('; ')
    expect((await call('/update-user', { name: 'Renamed' }, cookie)).status).toBe(200)
    const credentials = await fixture({ action: 'credentials', userId: signup.body.user.id })
    expect(
        (
            await call(
                '/passkey/update-passkey',
                { id: 'synthetic-passkey', name: 'Renamed' },
                cookie,
            )
        ).status,
    ).toBe(200)
    expect(
        (await call('/passkey/delete-passkey', { id: 'synthetic-passkey' }, cookie)).status,
    ).toBe(200)
    expect(
        (await call('/passkey/delete-passkey', { id: 'synthetic-passkey' }, cookie)).status,
    ).toBe(404)
    expect(
        (await call('/unlink-account', { accountId: credentials.accountId }, cookie)).status,
    ).toBe(200)
    const login = await call('/sign-in/email', {
        email: 'auth@example.invalid',
        password: 'synthetic-password',
    })
    expect(login.status).toBe(200)
    expect((await call('/revoke-session', { token: login.body.token }, cookie)).status).toBe(200)
    for (let index = 0; index < 2; index++)
        expect(
            (
                await call('/sign-in/email', {
                    email: 'auth@example.invalid',
                    password: 'synthetic-password',
                })
            ).status,
        ).toBe(200)
    expect((await call('/revoke-other-sessions', {}, cookie)).status).toBe(200)
    expect((await call('/sign-out', {}, cookie)).status).toBe(200)
    const rows = (await fixture({ action: 'events' })).filter(
        (item: { actorId: string }) => item.actorId === signup.body.user.id,
    )
    expect(rows.map((item: { action: string }) => item.action)).toEqual(
        expect.arrayContaining([
            'account.create',
            'session.create',
            'account.update',
            'session.revoke',
            'session.logout',
            'provider.link',
            'provider.unlink',
            'passkey.update',
            'passkey.delete',
        ]),
    )
    expect(
        rows.filter((item: { action: string }) => item.action === 'session.revoke'),
    ).toHaveLength(3)
    expect(JSON.stringify(rows)).not.toContain('synthetic-password')
    expect(JSON.stringify(rows)).not.toContain(login.body.token)
    expect(
        rows.filter((item: { action: string }) => item.action === 'passkey.delete'),
    ).toHaveLength(1)
    expect(JSON.stringify(rows)).not.toMatch(/SECRET_LINK|synthetic-key|synthetic-credential/)
    const count = rows.length
    expect(
        (
            await call('/sign-in/email', {
                email: 'auth@example.invalid',
                password: 'wrong-password',
            })
        ).status,
    ).toBe(401)
    expect(
        (await fixture({ action: 'events' })).filter(
            (item: { actorId: string }) => item.actorId === signup.body.user.id,
        ),
    ).toHaveLength(count)
    await fixture({ action: 'failActivity' })
    expect(
        (
            await call('/sign-in/email', {
                email: 'auth@example.invalid',
                password: 'synthetic-password',
            })
        ).status,
    ).toBe(200)
})

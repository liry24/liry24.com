import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'

interface MockSessionRow {
    id: string
    token?: string
}

interface MockAuthClient {
    listSessions: Mock<() => Promise<{ data?: Array<MockSessionRow> }>>
    revokeSession: Mock<(input: { token: string }) => Promise<{ error?: { message: string } }>>
    revokeOtherSessions: Mock<() => Promise<{ error?: { message: string } }>>
}

interface MockAppSession {
    user: Ref<{ id: string } | null>
    session: Ref<{ id: string } | null>
    signOut: Mock<() => Promise<void>>
}

const { boundary } = vi.hoisted(() => ({
    boundary: {
        client: undefined as MockAuthClient | undefined,
        identity: undefined as MockAppSession | undefined,
    },
}))

function getClient(): MockAuthClient {
    if (!boundary.client) throw new Error('MockAuthClient was not initialized')

    return boundary.client
}

mockNuxtImport('authClient', () => ({
    listSessions: () => getClient().listSessions(),
    revokeSession: (input: { token: string }) => getClient().revokeSession(input),
    revokeOtherSessions: () => getClient().revokeOtherSessions(),
}))
mockNuxtImport('useAppSession', () => () => boundary.identity)

interface MountedWrapper {
    unmount(): void
}

let wrapper: MountedWrapper | undefined
beforeEach(() => {
    let rows = [
        { id: 'current', token: 'current-token' },
        { id: 'other', token: 'private-token' },
        { id: 'spare', token: 'spare-token' },
    ]
    boundary.client = {
        listSessions: vi.fn(async () => ({ data: rows })),
        revokeSession: vi.fn(async ({ token }) => {
            rows = rows.filter((row) => row.token !== token)
            return {}
        }),
        revokeOtherSessions: vi.fn(async () => {
            rows = rows.filter((row) => row.id === 'current')
            return {}
        }),
    }
    boundary.identity = {
        user: ref({ id: 'alice' }),
        session: ref({ id: 'current' }),
        signOut: vi.fn(async () => {}),
    }
})
afterEach(() => wrapper?.unmount())

async function setup() {
    let result!: ReturnType<typeof useAdminSessions>
    wrapper = await mountSuspended(
        defineComponent({
            setup() {
                result = useAdminSessions()
                return () => h('div')
            },
        }),
    )
    await vi.waitFor(() => {
        expect(result.busy.value).toBe(false)
    })
    return result
}

test('native individual and bulk revocation refresh the list', async () => {
    const sessions = await setup()
    const ids = () => sessions.sessions.value.map(({ id }) => id)
    expect(ids()).toEqual(['current', 'other', 'spare'])
    await sessions.revoke('private-token')
    expect(ids()).toEqual(['current', 'spare'])
    await sessions.revokeOthers()
    expect(ids()).toEqual(['current'])
})

test('failures are visible, concurrent writes are ignored, and identities cannot retain sessions', async () => {
    const sessions = await setup()
    let finish!: (value: { error?: { message: string } }) => void
    boundary.client?.revokeSession.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        }),
    )
    const pending = sessions.revoke('private-token')
    await sessions.revokeOthers()
    expect(boundary.client?.revokeOtherSessions).not.toHaveBeenCalled()
    const upstreamError = 'SENSITIVE_REMOTE_DETAIL'
    finish({ error: { message: upstreamError } })
    await pending
    expect(sessions.failure.value).toBeTruthy()
    expect(sessions.failure.value).not.toContain(upstreamError)
    if (boundary.identity) boundary.identity.user.value = { id: 'bob' }

    expect(sessions.sessions.value).toEqual([])
    let finishList!: (value: { data?: Array<MockSessionRow> }) => void
    boundary.client?.listSessions.mockReturnValueOnce(
        new Promise((resolve) => {
            finishList = resolve
        }),
    )
    const refresh = sessions.refresh()
    if (boundary.identity) boundary.identity.user.value = { id: 'carol' }

    finishList({ data: [{ id: 'bob-session' }] })
    await refresh
    expect(sessions.sessions.value).toEqual([])
})

test.each([
    [
        'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0',
        'Edge',
        'Windows',
        'Computer',
    ],
    ['Mozilla/5.0 (iPhone) Version/18.0 Mobile/15 Safari/604.1', 'Safari', 'iOS', 'Phone'],
    ['Mozilla/5.0 (iPad) CriOS/130.0 Mobile/15 Safari/604.1', 'Chrome', 'iOS', 'Tablet'],
    ['Mozilla/5.0 (Linux; Android 14) Firefox/130.0', 'Firefox', 'Android', 'Tablet'],
])('user agent %s', (ua, browser, os, device) => {
    expect(adminSessionDevice(ua)).toMatchObject({ browser, os, device })
})

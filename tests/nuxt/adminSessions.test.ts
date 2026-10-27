import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { adminSessionDevice, useAdminSessions } from '#imports'

const { boundary } = vi.hoisted(() => ({ boundary: {} as Record<string, any> }))
mockNuxtImport('authClient', () => new Proxy({}, { get: (_target, key) => boundary.client?.[key] }))
mockNuxtImport('useAppSession', () => () => boundary.identity)
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
    boundary.client = {
        listSessions: vi.fn(async () => ({
            data: [{ id: 'current' }, { id: 'other', token: 'private-token' }],
        })),
        revokeSession: vi.fn(async () => ({})),
        revokeOtherSessions: vi.fn(async () => ({})),
    }
    boundary.identity = {
        user: ref({ id: 'alice' }),
        session: ref({ id: 'current' }),
        signOut: vi.fn(),
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
    await vi.waitFor(() => expect(result.busy.value).toBe(false))
    return result
}
test('native individual and bulk revocation refresh the list', async () => {
    const sessions = await setup()
    expect(sessions.sessions.value).toHaveLength(2)
    await sessions.revoke('private-token')
    expect(boundary.client.revokeSession).toHaveBeenCalledWith({ token: 'private-token' })
    await sessions.revokeOthers()
    expect(boundary.client.revokeOtherSessions).toHaveBeenCalledOnce()
    expect(boundary.client.listSessions).toHaveBeenCalledTimes(3)
})
test('failures are visible, concurrent writes are ignored, and identities cannot retain sessions', async () => {
    const sessions = await setup()
    let finish!: (value: unknown) => void
    boundary.client.revokeSession.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        }),
    )
    const pending = sessions.revoke('private-token')
    await sessions.revokeOthers()
    expect(boundary.client.revokeOtherSessions).not.toHaveBeenCalled()
    finish({ error: { message: 'secret upstream error' } })
    await pending
    expect(sessions.failure.value).toContain('Please try again')
    expect(sessions.failure.value).not.toContain('secret')
    boundary.identity.user.value = { id: 'bob' }
    expect(sessions.sessions.value).toEqual([])
    boundary.client.listSessions.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        }),
    )
    const refresh = sessions.refresh()
    boundary.identity.user.value = { id: 'carol' }
    finish({ data: [{ id: 'bob-session' }] })
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
    ['', 'Unknown browser', 'Unknown OS', 'Unknown device'],
])('user agent %s', (ua, browser, os, device) =>
    expect(adminSessionDevice(ua)).toMatchObject({ browser, os, device }),
)

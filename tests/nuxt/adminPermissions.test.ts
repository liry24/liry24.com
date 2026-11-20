import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { clearNuxtData, useAdminPermissions, useNuxtApp } from '#imports'

const { boundary } = vi.hoisted(() => ({ boundary: {} as Record<string, any> }))
mockNuxtImport('useRequestFetch', () => () => boundary.request)
mockNuxtImport('useAppSession', () => () => boundary.identity)

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let nuxtApp: ReturnType<typeof useNuxtApp>
let originalSsrContext: PropertyDescriptor | undefined
beforeEach(() => {
    boundary.identity = {
        user: ref({ id: 'alice', role: 'admin' }),
        session: ref({ id: 'first-session' }),
    }
    boundary.permissions = { users: true, compose: true }
    boundary.request = vi.fn(
        async (_url: string, options: { body: { permissions: Record<string, string[]> } }) => ({
            success: options.body.permissions.user
                ? boundary.permissions.users
                : boundary.permissions.compose,
        }),
    )
})
afterEach(() => {
    if (nuxtApp) {
        nuxtApp.isHydrating = false
        nuxtApp.runWithContext(() => clearNuxtData((key) => key.startsWith('admin-users:')))
        for (const key of Object.keys(nuxtApp.static.data)) {
            if (key.startsWith('admin-users:')) delete nuxtApp.static.data[key]
        }
        if (originalSsrContext) Object.defineProperty(nuxtApp, 'ssrContext', originalSsrContext)
        else Reflect.deleteProperty(nuxtApp, 'ssrContext')
    }
    wrapper?.unmount()
    wrapper = undefined
})

async function setup(server = false) {
    let permissions!: ReturnType<typeof useAdminPermissions>
    wrapper = await mountSuspended(
        defineComponent({
            setup() {
                nuxtApp = useNuxtApp()
                originalSsrContext = Object.getOwnPropertyDescriptor(nuxtApp, 'ssrContext')
                if (server)
                    Object.defineProperty(nuxtApp, 'ssrContext', { configurable: true, value: {} })
                permissions = useAdminPermissions()
                return () => h('div')
            },
        }),
    )
    await permissions
    return permissions
}

test('a completed request is reused only for another initial read in the same SSR request', async () => {
    const permissions = await setup(true)
    expect(boundary.request).toHaveBeenCalledTimes(2)
    Object.defineProperty(nuxtApp, 'ssrContext', { configurable: true, value: {} })
    await permissions.execute({ cause: 'initial' })
    expect(boundary.request).toHaveBeenCalledTimes(2)

    boundary.permissions = { users: false, compose: false }
    await permissions.refresh()
    expect(boundary.request).toHaveBeenCalledTimes(4)
    expect(permissions.data.value).toEqual({ users: false, compose: false })
    await permissions.execute({ cause: 'initial' })
    expect(boundary.request).toHaveBeenCalledTimes(4)

    Reflect.deleteProperty(nuxtApp, 'ssrContext')
    await permissions.execute({ cause: 'initial' })
    expect(boundary.request).toHaveBeenCalledTimes(6)
})

test('a failed refresh cannot make an earlier successful payload reusable', async () => {
    const permissions = await setup(true)
    Object.defineProperty(nuxtApp, 'ssrContext', { configurable: true, value: {} })
    boundary.request.mockRejectedValueOnce(new Error('Permission service unavailable'))
    await permissions.refresh()
    expect(permissions.status.value).toBe('error')

    boundary.permissions = { users: false, compose: false }
    await permissions.execute({ cause: 'initial' })
    expect(boundary.request).toHaveBeenCalledTimes(6)
    expect(permissions.status.value).toBe('success')
    expect(permissions.data.value).toEqual({ users: false, compose: false })
})

test('hydration and static payload reads keep Nuxt behavior, while explicit refresh fetches', async () => {
    const permissions = await setup()
    const key = 'admin-users:alice:first-session:admin:permissions'
    nuxtApp.isHydrating = true
    await permissions.execute({ cause: 'initial' })
    expect(boundary.request).toHaveBeenCalledTimes(2)

    nuxtApp.isHydrating = false
    nuxtApp.static.data[key] = { users: false, compose: false }
    await permissions.execute({ cause: 'initial' })
    expect(boundary.request).toHaveBeenCalledTimes(2)
    expect(permissions.data.value).toEqual({ users: false, compose: false })

    await permissions.execute({ cause: 'refresh:hook' })
    expect(boundary.request).toHaveBeenCalledTimes(4)
    expect(permissions.data.value).toEqual({ users: true, compose: true })
})

test.each(['user', 'session', 'role', 'logout'])(
    '%s changes clear the previous scope before the next permission response',
    async (change) => {
        const permissions = await setup()
        const previousKey = 'admin-users:alice:first-session:admin:permissions'
        boundary.permissions = { users: false, compose: false }
        if (change === 'user') boundary.identity.user.value = { id: 'bob', role: 'admin' }
        if (change === 'session') boundary.identity.session.value = { id: 'second-session' }
        if (change === 'role') boundary.identity.user.value = { id: 'alice', role: 'user' }
        if (change === 'logout') {
            boundary.identity.user.value = null
            boundary.identity.session.value = null
        }
        expect(nuxtApp.payload.data[previousKey]).toBeUndefined()
        await vi.waitFor(() => expect(permissions.status.value).toBe('success'))
        expect(permissions.data.value).toEqual({ users: false, compose: false })
        expect(boundary.request.mock.calls.length).toBeGreaterThan(2)
    },
)

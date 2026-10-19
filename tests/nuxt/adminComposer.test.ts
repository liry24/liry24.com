import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'

import { clearNuxtState } from '#app'

import { useAdminComposer } from '../../app/composables/useAdminComposer'
import type { ComposerBatch, ComposerPlan, ComposerRequest } from '../../shared/utils/adminComposer'

const { fetchBoundary } = vi.hoisted(() => ({ fetchBoundary: vi.fn() }))
mockNuxtImport('$fetch', () => fetchBoundary)
const { boundary } = vi.hoisted(() => ({ boundary: {} as Record<string, any> }))
mockNuxtImport('useUserSession', () => () => ({ user: boundary.user }))
mockNuxtImport('useI18n', () => () => ({ locale: boundary.locale }))
mockNuxtImport('useRoute', () => () => boundary.route)

const plan: ComposerPlan = {
    model: 'socials',
    intent: 'create',
    fields: [],
    visibleFields: [],
    datePurpose: 'none',
    values: {},
    publishAt: '',
    timeZone: 'Asia/Tokyo',
    dateIncomplete: false,
    query: '',
    results: [],
    total: 0,
}
const response = (request: ComposerRequest, title = ''): ComposerBatch => ({
    requestId: request.requestId,
    items: [0, 1].map((index) => ({
        id: request.requestId + '.' + index,
        source: { start: 0, end: request.prompt.length },
        plan: { ...plan, values: { label: title } },
    })),
})
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
    fetchBoundary.mockReset()
    clearNuxtState('admin-composer')
    boundary.user = ref({ id: 'alice' })
    boundary.locale = ref('ja')
    boundary.route = reactive({ path: '/admin/data', params: {} })
})
afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
async function setup(
    fetcher = vi.fn(async (_url: string, options: { body: ComposerRequest; signal: AbortSignal }) =>
        response(options.body),
    ),
) {
    fetchBoundary.mockImplementation(fetcher)
    const instances: ReturnType<typeof useAdminComposer>[] = []
    const Child = defineComponent({
        setup() {
            instances.push(useAdminComposer())
            return () => h('span')
        },
    })
    wrapper = await mountSuspended(
        defineComponent({
            setup() {
                instances.push(useAdminComposer())
                return () => h('div', [h(Child), h(Child)])
            },
        }),
    )
    vi.useFakeTimers()
    return { composer: instances[0]!, instances, fetcher }
}
const pause = async () => {
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
}

test('layout and children share one controller; IME and typing send once after 300ms', async () => {
    const { composer, instances, fetcher } = await setup()
    expect(instances[1]).toBe(composer)
    expect(instances[2]).toBe(composer)
    composer.composing.value = true
    composer.prompt.value = 'First'
    await pause()
    expect(fetcher).not.toHaveBeenCalled()
    composer.composing.value = false
    composer.prompt.value = 'Latest'
    await vi.advanceTimersByTimeAsync(299)
    expect(fetcher).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
        body: { prompt: 'Latest', locale: 'ja' },
        retry: 0,
    })
    expect(composer.pending.value).toBe(false)
})

test('new input aborts immediately and late responses cannot replace the latest result', async () => {
    const requests: { request: ComposerRequest; resolve: (result: ComposerBatch) => void }[] = []
    const fetcher = vi.fn(
        (_url: string, options: { body: ComposerRequest; signal: AbortSignal }) =>
            new Promise<ComposerBatch>((resolve) =>
                requests.push({ request: options.body, resolve }),
            ),
    )
    const { composer } = await setup(fetcher)
    composer.prompt.value = 'First'
    await pause()
    composer.prompt.value = 'Second'
    expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true)
    await pause()
    requests[1]!.resolve(response(requests[1]!.request, 'Second'))
    await pause()
    requests[0]!.resolve(response(requests[0]!.request, 'First'))
    await pause()
    expect(composer.result.value?.items[0]?.plan?.values.label).toBe('Second')
})

test('inactive surfaces stop requests; inline and modal switches retain results and edits', async () => {
    const { composer, fetcher } = await setup()
    boundary.route.path = '/admin'
    composer.prompt.value = 'Social'
    await pause()
    expect(fetcher).not.toHaveBeenCalled()
    composer.open.value = true
    await pause()
    composer.preparation(composer.result.value!.items[0]!.id).values.title = 'Edited title'
    composer.open.value = false
    boundary.route.path = '/admin/data'
    await pause()
    composer.open.value = true
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(composer.preparation(composer.result.value!.items[0]!.id).values.title).toBe(
        'Edited title',
    )
})

test('selection merges only its item and reopening does not resend the selection', async () => {
    const fetcher = vi.fn(async (_url: string, options: { body: ComposerRequest }) =>
        options.body.items
            ? {
                  requestId: options.body.requestId,
                  items: options.body.items.map((item) => ({
                      ...item,
                      plan: { ...plan, model: 'skills' as const },
                  })),
              }
            : response(options.body),
    )
    const { composer } = await setup(fetcher)
    composer.prompt.value = 'Two records'
    await pause()
    const untouched = composer.result.value!.items[1]
    composer.selectItem(composer.result.value!.items[0]!, 'skills')
    await pause()
    expect(composer.result.value!.items[0]?.plan?.model).toBe('skills')
    expect(composer.result.value!.items[1]).toBe(untouched)
    boundary.route.path = '/admin'
    composer.open.value = true
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(2)
})

test('errors retain existing items, permission failures are clear, and retry sends explicitly', async () => {
    const { composer, fetcher } = await setup()
    composer.prompt.value = 'Social'
    await pause()
    fetcher.mockRejectedValueOnce({ statusCode: 429, data: { message: 'Usage limit reached' } })
    composer.selectItem(composer.result.value!.items[0]!, 'skills')
    await pause()
    expect(composer.error.value).toBe('Usage limit reached')
    expect(composer.result.value!.items).toHaveLength(2)
    fetcher.mockRejectedValueOnce({ statusCode: 403 })
    await composer.retry()
    expect(composer.error.value).toContain('Sign in again')
    await composer.retry()
    expect(composer.error.value).toBe('')
    expect(composer.pending.value).toBe(false)
})

test('new prompts, user and locale changes clear results before any failed response', async () => {
    const { composer, fetcher } = await setup()
    composer.prompt.value = 'Social'
    await pause()
    fetcher.mockRejectedValueOnce(Error('Offline'))
    composer.prompt.value = 'Changed'
    expect(composer.result.value).toBeNull()
    await pause()
    expect(composer.error.value).toBe('Offline')
    composer.post.value = {
        scope: composer.scope.value,
        itemId: 'previous.0',
        values: { title: 'Private' },
        publishAt: '',
    }
    boundary.user.value = { id: 'bob' }
    expect(composer.prompt.value).toBe('')
    expect(composer.post.value).toBeNull()
    composer.prompt.value = 'Another'
    await pause()
    boundary.locale.value = 'en'
    expect(composer.prompt.value).toBe('')
    expect(composer.result.value).toBeNull()
})

test('context changes replace requests without losing Post Editor handoff', async () => {
    const { composer, fetcher } = await setup()
    composer.prompt.value = 'Post'
    await pause()
    const id = composer.result.value!.items[0]!.id
    composer.post.value = {
        scope: composer.scope.value,
        itemId: id,
        values: { title: 'Prepared' },
        publishAt: '2027-01-20T18:00',
    }
    boundary.route.path = '/admin/posts/new'
    expect(composer.result.value).toBeNull()
    expect(composer.post.value?.values.title).toBe('Prepared')
    composer.open.value = true
    await pause()
    expect(fetcher.mock.lastCall![1].body.context).toEqual({ model: 'posts' })
})

test('hiding or unmounting cancels pending work; busy is derived from active operations', async () => {
    const fetcher = vi.fn(
        (_url: string, _options: { body: ComposerRequest; signal: AbortSignal }) =>
            new Promise<ComposerBatch>(() => {}),
    )
    const { composer } = await setup(fetcher)
    composer.prompt.value = 'Social'
    await pause()
    boundary.route.path = '/admin'
    expect(fetcher.mock.lastCall![1].signal.aborted).toBe(true)
    expect(composer.pending.value).toBe(false)
    composer.open.value = true
    await pause()
    composer.setBusy('first', true)
    composer.setBusy('second', true)
    composer.setBusy('first', false)
    expect(composer.busy.value).toBe(true)
    composer.setBusy('second', false)
    expect(composer.busy.value).toBe(false)
    wrapper!.unmount()
    wrapper = undefined
    expect(fetcher.mock.lastCall![1].signal.aborted).toBe(true)
})

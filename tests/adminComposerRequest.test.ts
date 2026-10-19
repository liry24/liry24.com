import { afterEach, expect, test, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { useAdminComposerRequest } from '../app/composables/useAdminComposerRequest'
import { type ComposerPlan, type ComposerRequest } from '../shared/utils/adminComposer'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
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
const response = (title = '') =>
    new Response(
        JSON.stringify({ type: 'plan', plan: { ...plan, values: { label: title } } }) +
            '\n' +
            JSON.stringify({ type: 'complete' }) +
            '\n',
    )
function setup() {
    vi.useFakeTimers()
    const input = ref<ComposerRequest | null>(null)
    const composing = ref(false)
    const scope = effectScope()
    scopes.push(scope)
    const state = scope.run(() => useAdminComposerRequest(() => input.value, composing))!
    return { input, composing, state, scope }
}
const request = {
    prompt: 'Social link',
    locale: 'ja',
    timeZone: 'Asia/Tokyo',
    batch: true,
    requestId: 'request1',
} as const
const tick = async () => {
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
}
test('IME composition and bursts of typing produce one request after the pause', async () => {
    const fetcher = vi.fn(async () => response())
    vi.stubGlobal('fetch', fetcher)
    const { input, composing, state } = setup()
    composing.value = true
    input.value = request
    await tick()
    expect(fetcher).not.toHaveBeenCalled()
    composing.value = false
    input.value = { ...request, prompt: 'Latest input' }
    await tick()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).prompt).toBe('Latest input')
    expect(state.running.value).toBe(false)
    expect(state.result.value?.items[0]?.plan?.model).toBe('socials')
})
test('new input aborts immediately and late responses cannot replace newer input', async () => {
    const pending: ((value: Response) => void)[] = []
    const fetcher = vi.fn(
        (_url: unknown, _options: RequestInit) =>
            new Promise<Response>((resolve) => pending.push(resolve)),
    )
    vi.stubGlobal('fetch', fetcher)
    const { input, state } = setup()
    input.value = request
    await tick()
    const signal = fetcher.mock.calls[0]![1].signal!
    input.value = { ...request, prompt: 'Second', requestId: 'request2' }
    expect(signal.aborted).toBe(true)
    await tick()
    pending[1]!(response('Second'))
    await vi.advanceTimersByTimeAsync(0)
    pending[0]!(response('First'))
    await vi.advanceTimersByTimeAsync(0)
    expect(state.result.value?.items[0]?.plan?.values.label).toBe('Second')
})
test('stream failure preserves a usable complete form; permission errors are explicit', async () => {
    const fetcher = vi.fn(
        async () =>
            new Response(
                JSON.stringify({ type: 'plan', plan }) +
                    '\n' +
                    JSON.stringify({ type: 'error', message: 'Usage limit reached' }) +
                    '\n',
            ),
    )
    vi.stubGlobal('fetch', fetcher)
    const { input, state } = setup()
    input.value = request
    await tick()
    expect(state.error.value).toBe('Usage limit reached')
    expect(state.result.value?.items[0]?.plan).toEqual(plan)
    fetcher.mockImplementation(async () => new Response('', { status: 403 }))
    await state.run()
    expect(state.error.value).toContain('Sign in again')
})
test('unmounting cancels inference and inactive surfaces never request it', async () => {
    const fetcher = vi.fn((_url: unknown, _options: RequestInit) => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetcher)
    const { input, scope } = setup()
    await tick()
    expect(fetcher).not.toHaveBeenCalled()
    input.value = request
    await tick()
    scope.stop()
    expect(fetcher.mock.calls[0]![1].signal!.aborted).toBe(true)
})

test('an early stream end keeps the received plan available for editing', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ type: 'plan', plan }) + '\n')),
    )
    const { input, state } = setup()
    input.value = request
    await tick()
    expect(state.error.value).toContain('ended early')
    expect(state.result.value?.items[0]?.plan).toEqual(plan)
    expect(state.running.value).toBe(false)
})

test('a new request removes old forms immediately, even when inference fails', async () => {
    const fetcher = vi.fn(async () => response('First'))
    vi.stubGlobal('fetch', fetcher)
    const { input, state } = setup()
    input.value = request
    await tick()
    expect(state.result.value?.items[0]?.plan?.values.label).toBe('First')
    fetcher.mockImplementation(async () => new Response('', { status: 500 }))
    input.value = { ...request, prompt: 'Changed', requestId: 'request2' }
    expect(state.result.value).toBeNull()
    await tick()
    expect(state.result.value).toBeNull()
    expect(state.error.value).toBeTruthy()
})

test('item selection merges only its response and keeps other items and IDs', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, options) => {
            const request = JSON.parse(options.body)
            const items = request.items
                ? [
                      {
                          ...request.items[0],
                          plan: { ...plan, model: 'skills' },
                      },
                  ]
                : [0, 1].map((i) => ({
                      id: 'request1.' + i,
                      source: { start: 0, end: 5 },
                      plan,
                  }))
            return new Response(
                JSON.stringify({ type: 'batch', batch: { requestId: 'request1', items } }) + '\n',
            )
        }),
    )
    const { input, state } = setup()
    input.value = request
    await tick()
    const unchanged = state.result.value!.items[1]
    input.value = {
        ...request,
        items: [{ id: 'request1.0', source: { start: 0, end: 5 }, model: 'skills' }],
    }
    await tick()
    expect(state.result.value!.items[0]?.plan?.model).toBe('skills')
    expect(state.result.value!.items[1]).toBe(unchanged)
})

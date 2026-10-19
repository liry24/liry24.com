import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, expect, test, vi } from 'vitest'
import { effectScope, reactive, ref, watch } from 'vue'

import { usePostProofreading } from '../../app/composables/usePostProofreading'

const { aiBoundary } = vi.hoisted(() => ({ aiBoundary: vi.fn() }))
mockNuxtImport('useAi', () => aiBoundary)

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop()
    vi.unstubAllGlobals()
})
function setup() {
    const values = reactive({ title: '', content: 'Original', tags: [] as string[] })
    const identity = ref(['new', 'ja']),
        blocked = ref(false)
    const data = ref<{ content: string }>(),
        status = ref('idle'),
        error = ref<Error>()
    const response = ref('Suggestion')
    const clear = vi.fn(() => {
        data.value = undefined
        error.value = undefined
        status.value = 'idle'
    })
    const execute = vi.fn(async () => {
        status.value = 'pending'
        await Promise.resolve()
        data.value = { content: response.value }
        status.value = 'success'
    })
    const action = { data, status, error, clear, execute }
    const useAi = aiBoundary.mockReset().mockReturnValue(action)
    const form = {
        state: { values },
        atom: {
            subscribe: (listener: (state: { values: typeof values }) => void) => ({
                unsubscribe: watch(
                    () => values.content,
                    () => listener({ values }),
                    { flush: 'sync' },
                ),
            }),
        },
        setFieldValue: vi.fn((_name: 'content', value: string) => {
            values.content = value
        }),
    }
    const scope = effectScope()
    scopes.push(scope)
    const review = scope.run(() =>
        usePostProofreading(form, { identity: () => identity.value, blocked: () => blocked.value }),
    )!
    return { review, form, identity, blocked, response, action, useAi }
}

test('body-only proofreading keeps the suggestion for review and applies only content', async () => {
    const { review, form, useAi, action } = setup()
    expect(review.proposal).toBe(action.data)
    expect(review.error).toBe(action.error)
    await review.run()
    expect(useAi.mock.calls[0]).toEqual([
        'proofread',
        { input: expect.objectContaining({ value: { content: 'Original' } }), immediate: false },
    ])
    expect(review.originalContent.value).toBe('Original')
    expect(form.state.values.content).toBe('Original')
    form.state.values.title = 'A title changed while reviewing'
    form.state.values.tags.push('new tag')
    expect(review.stale.value).toBe(false)
    review.apply()
    expect(form.setFieldValue).toHaveBeenCalledExactlyOnceWith('content', 'Suggestion')
    expect(form.state.values.title).toBe('A title changed while reviewing')
    expect(review.proposal.value).toBeUndefined()
})

test('changed body and empty suggestions cannot be applied; discard keeps input', async () => {
    const { review, form, response } = setup()
    await review.run()
    form.state.values.content = 'New local body'
    expect(review.stale.value).toBe(true)
    review.apply()
    expect(form.setFieldValue).not.toHaveBeenCalled()
    review.discard()
    expect(form.state.values.content).toBe('New local body')
    response.value = ' '
    await review.run()
    expect(review.invalid.value).toBe(true)
    review.apply()
    expect(form.setFieldValue).not.toHaveBeenCalled()
})

test('changing article or locale clears review; blocked, duplicate and empty-body requests are ignored', async () => {
    const { review, identity, blocked, form, action } = setup()
    blocked.value = true
    await review.run()
    expect(action.execute).not.toHaveBeenCalled()
    blocked.value = false
    const pending = review.run()
    await review.run()
    await pending
    expect(action.execute).toHaveBeenCalledTimes(1)
    identity.value = ['new', 'en']
    expect(review.proposal.value).toBeUndefined()
    await review.run()
    identity.value = ['another', 'en']
    expect(review.proposal.value).toBeUndefined()
    form.state.values.content = ' '
    await review.run()
    expect(action.execute).toHaveBeenCalledTimes(2)
})

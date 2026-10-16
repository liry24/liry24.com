import type { Spec } from '@json-render/core'
import { watchDebounced } from '@vueuse/core'
import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import {
    defaultComposerSpec,
    type ComposerEvent,
    type ComposerPlan,
    type ComposerRequest,
} from '~~/shared/utils/adminComposer'

export function useAdminComposerRequest(
    input: () => ComposerRequest | null,
    composing: Ref<boolean>,
) {
    const result = shallowRef<{ plan: ComposerPlan; spec: Spec } | null>(null)
    const running = ref(false)
    const error = ref('')
    const fallback = ref(false)
    let controller: AbortController | undefined
    let generation = 0
    const cancel = () => {
        generation++
        controller?.abort()
        running.value = false
    }
    watch(
        [input, composing],
        () => {
            cancel()
            running.value = Boolean(input() && !composing.value)
            error.value = ''
        },
        { flush: 'sync', deep: true },
    )
    async function run() {
        cancel()
        const request = input()
        if (!request || composing.value) return
        const ownGeneration = generation
        controller = new AbortController()
        running.value = true
        error.value = ''
        let plan: ComposerPlan | undefined
        let complete = false
        try {
            const response = await fetch('/api/admin/compose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal,
            })
            if (!response.ok || !response.body)
                throw new Error(
                    response.status === 401 || response.status === 403
                        ? 'Your session cannot access this content. Sign in again.'
                        : 'Could not prepare the form.',
                )
            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
            let buffer = ''
            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (ownGeneration !== generation) return
                    if (done) break
                    buffer += value
                    if (buffer.length > 256_000) throw new Error('The response was too large.')
                    let end: number
                    while ((end = buffer.indexOf('\n')) >= 0) {
                        const line = buffer.slice(0, end)
                        buffer = buffer.slice(end + 1)
                        if (!line) continue
                        const event = JSON.parse(line) as ComposerEvent
                        if (event.type === 'error') throw new Error(event.message)
                        if (event.type === 'plan') plan = event.plan
                        else if (plan && (event.type === 'step' || event.type === 'complete')) {
                            result.value = { plan, spec: event.spec }
                            if (event.type === 'complete') {
                                complete = true
                                fallback.value = event.fallback
                            }
                        }
                    }
                }
                if (!complete)
                    throw new Error(
                        'The response ended early. You can continue with the regular form.',
                    )
            } finally {
                await reader.cancel().catch(() => {})
                reader.releaseLock()
            }
        } catch (cause) {
            if (ownGeneration !== generation) return
            error.value = cause instanceof Error ? cause.message : 'Could not prepare the form.'
            if (plan) {
                result.value = { plan, spec: defaultComposerSpec(plan) }
                fallback.value = true
            }
        } finally {
            if (ownGeneration === generation) running.value = false
        }
    }
    watchDebounced([input, composing], run, { debounce: 300, deep: true, immediate: true })
    onScopeDispose(cancel)
    return { result, running, error, fallback, run, cancel }
}

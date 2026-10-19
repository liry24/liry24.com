export function useAdminComposerRequest(
    input: () => ComposerRequest | null,
    composing: Ref<boolean>,
    result: Ref<ComposerBatch | null> = shallowRef(null),
) {
    const running = ref(false)
    const error = ref('')
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
            if (!input() || result.value?.requestId !== input()?.requestId) result.value = null
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
        function apply(batch: ComposerBatch) {
            if (request!.requestId && batch.requestId !== request!.requestId)
                throw new Error('The response belongs to another request.')
            result.value =
                request!.items && result.value?.requestId === batch.requestId
                    ? {
                          ...result.value,
                          items: result.value.items.map(
                              (item) => batch.items.find((next) => next.id === item.id) ?? item,
                          ),
                      }
                    : batch
        }
        function single() {
            apply({
                requestId: request!.requestId ?? '',
                items: [
                    {
                        id: (request!.requestId ?? '') + '.0',
                        source: { start: 0, end: request!.prompt.length },
                        model: request!.model,
                        entryId: request!.entryId,
                        plan,
                    },
                ],
            })
        }
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
                        if (event.type === 'batch') {
                            apply(event.batch)
                            complete = true
                        } else if (event.type === 'plan') plan = event.plan
                        else if (plan && event.type === 'complete') {
                            single()
                            complete = true
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
            if (plan) single()
        } finally {
            if (ownGeneration === generation) running.value = false
        }
    }
    watchDebounced(
        [input, composing],
        () => {
            const request = input()
            if (
                request?.requestId &&
                result.value?.requestId === request.requestId &&
                !request.items
            ) {
                running.value = false
                return
            }
            return run()
        },
        { debounce: 300, deep: true, immediate: true },
    )
    onScopeDispose(cancel)
    return { result, running, error, run, cancel }
}

import type { Predictor } from 'gpu-icons-search'

export function useAdminIconSearch(isOpen: () => boolean) {
    let session = 0
    let predictor: Promise<Predictor> | undefined
    let idleTimer: ReturnType<typeof setTimeout> | undefined

    function disposePredictor() {
        void predictor?.then(
            (model) => model.dispose(),
            () => {},
        )
        predictor = undefined
    }
    watch(
        isOpen,
        (open) => {
            clearTimeout(idleTimer)
            if (!open) {
                session++
                idleTimer = setTimeout(disposePredictor, 60_000)
            }
        },
        { flush: 'sync' },
    )
    onScopeDispose(() => {
        session++
        clearTimeout(idleTimer)
        disposePredictor()
    })

    function cachePredictor(pending: Promise<Predictor>) {
        predictor = pending
        void pending.catch(() => {
            if (predictor === pending) predictor = undefined
        })
        return pending
    }

    async function predict(query: string, signal: AbortSignal) {
        const active = session
        try {
            const { createPredictor, isSupported } = await import('gpu-icons-search')
            signal.throwIfAborted()
            if (active !== session) return []
            const pending =
                predictor ??
                cachePredictor(
                    isSupported()
                        ? createPredictor({ backend: 'webgpu' }).catch(() =>
                              createPredictor({ backend: 'cpu' }),
                          )
                        : createPredictor({ backend: 'cpu' }),
                )
            const model = await pending
            signal.throwIfAborted()
            if (active !== session) return []
            try {
                return await model.predict(query, { limit: 2, signal })
            } catch (error) {
                signal.throwIfAborted()
                if (active !== session || model.backend !== 'webgpu') throw error
                if (predictor === pending) {
                    model.dispose()
                    cachePredictor(createPredictor({ backend: 'cpu' }))
                }
                const fallback = await predictor
                signal.throwIfAborted()
                if (!fallback || active !== session) return []
                return await fallback.predict(query, { limit: 2, signal })
            }
        } catch {
            signal.throwIfAborted()
            return []
        }
    }

    return async (
        input: string,
        signal: AbortSignal,
        onUpdate?: (items: Array<string>) => void,
    ): Promise<Array<string>> => {
        const query = input.trim()
        if (query.length < 2) return []
        const [direct, predictions] = await Promise.all([
            searchIconify(query, signal).then((items) => {
                signal.throwIfAborted()
                onUpdate?.(items)
                return items
            }),
            predict(query, signal),
        ])
        const words = [...new Set(predictions.map(({ word }) => word))].filter(
            (word) => word.toLowerCase() !== query.toLowerCase(),
        )
        const related = await Promise.all(
            words.map((word) => searchIconify(word, signal).catch(() => [])),
        )
        signal.throwIfAborted()
        // Interleave the expansions so the first related term cannot fill the entire list.
        const expanded = Array.from({ length: 32 }, (_, i) =>
            related.flatMap((ids) => (ids[i] ? [ids[i]] : [])),
        ).flat()
        return [...new Set([...direct, ...expanded])].slice(0, 48)
    }
}

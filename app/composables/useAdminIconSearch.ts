import type { Predictor } from 'gpu-icons-search'

export function useAdminIconSearch(isOpen: () => boolean) {
    let session = 0
    let predictor: Promise<Predictor> | undefined

    function reset() {
        session++
        void predictor?.then(
            (model) => model.dispose(),
            () => {},
        )
        predictor = undefined
    }
    watch(
        isOpen,
        (open) => {
            if (!open) reset()
        },
        { flush: 'sync' },
    )
    onScopeDispose(reset)

    async function predict(query: string, signal: AbortSignal) {
        const active = session
        try {
            const { createPredictor, isSupported } = await import('gpu-icons-search')
            signal.throwIfAborted()
            if (active !== session) return []
            predictor ??= isSupported()
                ? createPredictor({ backend: 'webgpu' }).catch(() =>
                      createPredictor({ backend: 'cpu' }),
                  )
                : createPredictor({ backend: 'cpu' })
            const pending = predictor
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
                    predictor = createPredictor({ backend: 'cpu' })
                }
                const fallback = await predictor
                signal.throwIfAborted()
                return await fallback.predict(query, { limit: 2, signal })
            }
        } catch {
            signal.throwIfAborted()
            return []
        }
    }

    return async (input: string, signal: AbortSignal): Promise<Array<string>> => {
        const query = input.trim()
        if (query.length < 2) return []
        const [direct, predictions] = await Promise.all([
            searchIconify(query, signal),
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

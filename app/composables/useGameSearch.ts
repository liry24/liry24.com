export const useGameSearch = (query: () => string | null) => {
    const { session } = useAppSession()
    const games = ref<Array<GameSearchResult>>([])
    const warning = ref('')
    const loading = ref(false)
    const importing = ref(false)
    const cache = new Map<string, { games: Array<GameSearchResult>; warning: string }>()
    let search: AbortController | undefined
    let insertion: AbortController | undefined

    const runSearch = async (text: string, controller: AbortController) => {
        try {
            const result =
                cache.get(text) ??
                (await $fetch('/api/admin/games', {
                    query: { q: text },
                    signal: controller.signal,
                }))
            if (controller.signal.aborted) return
            if (!result) throw new Error('No search result was returned')

            cache.set(text, result)
            games.value = result.games
            warning.value = result.warning
        } catch {
            if (!controller.signal.aborted)
                warning.value = 'Search unavailable. You can continue editing.'
        } finally {
            if (!controller.signal.aborted) loading.value = false
        }
    }

    const { start: scheduleSearch, stop: stopSearchTimer } = useTimeoutFn(
        (text: string, controller: AbortController) => {
            void runSearch(text, controller)
        },
        250,
        { immediate: false },
    )

    const cancelSearch = () => {
        stopSearchTimer()
        search?.abort()
        loading.value = false
    }

    watch(
        [query, () => session.value?.id],
        ([text, sessionId], [, previousSessionId]) => {
            cancelSearch()
            if (sessionId !== previousSessionId) {
                cache.clear()
                insertion?.abort()
                importing.value = false
            }
            games.value = []
            warning.value = ''
            if (text === null) return

            const controller = (search = new AbortController())
            loading.value = true
            scheduleSearch(text, controller)
        },
        { immediate: true, flush: 'sync' },
    )

    async function importGame(game: GameSearchResult) {
        if (importing.value) return

        const controller = (insertion = new AbortController())
        importing.value = true
        warning.value = ''

        try {
            const saved = game.id
                ? game
                : await $fetch('/api/admin/games', {
                      method: 'POST',
                      body: { igdbId: game.igdbId },
                      signal: controller.signal,
                  })
            if (controller.signal.aborted) return

            cache.clear()
            return saved
        } catch {
            if (!controller.signal.aborted)
                warning.value = 'Import failed. Your input has been kept.'
        } finally {
            if (insertion === controller) importing.value = false
        }
    }

    onScopeDispose(() => {
        cancelSearch()
        insertion?.abort()
    })

    return { games, warning, loading, importing, importGame }
}

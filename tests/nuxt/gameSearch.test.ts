import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, expect, test, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useGameSearch } from '../../app/composables/useGameSearch'

const { sessionBoundary } = vi.hoisted(() => ({ sessionBoundary: vi.fn() }))
mockNuxtImport('useAppSession', () => sessionBoundary)

const { fetchBoundary } = vi.hoisted(() => ({ fetchBoundary: vi.fn() }))
mockNuxtImport('$fetch', () => fetchBoundary)
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
const game: GameSearchResult = { igdbId: 1, slug: 'game', name: 'Game' }
const result = { games: [game], warning: '' }
function setup(initial: string | null = null) {
    vi.useFakeTimers()
    const query = ref(initial)
    const user = ref({ id: 'alice', role: 'admin' })
    const session = ref({ id: 'session-1' })
    sessionBoundary.mockReturnValue({ user, session })
    const scope = effectScope()
    scopes.push(scope)
    return {
        query,
        user,
        session,
        scope,
        state: scope.run(() => useGameSearch(() => query.value))!,
    }
}
const pause = () => vi.advanceTimersByTimeAsync(250)

test('disabled searches make no request, an empty query finds saved games, and typing is debounced', async () => {
    const fetcher = vi.fn(
        async (_url: string, _options: { query?: { q: string }; signal: AbortSignal }) => result,
    )
    fetchBoundary.mockImplementation(fetcher)
    const { query, state } = setup()
    await pause()
    expect(fetcher).not.toHaveBeenCalled()
    query.value = ''
    await pause()
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ query: { q: '' } })
    expect(state.games.value).toEqual([game])
    query.value = 'g'
    query.value = 'game'
    expect(state.games.value).toEqual([])
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]![1]).toMatchObject({ query: { q: 'game' } })
    query.value = ''
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(state.loading.value).toBe(false)
})

test('late search responses and errors cannot replace the latest candidates or poison its cache', async () => {
    const first = Promise.withResolvers<typeof result>()
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(result)
    fetchBoundary.mockImplementation(fetcher)
    const { query, state } = setup('first')
    await pause()
    query.value = 'second'
    expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true)
    await pause()
    first.resolve({ games: [{ ...game, name: 'Old' }], warning: 'Old warning' })
    await pause()
    expect(state.games.value).toEqual([game])
    expect(state.warning.value).toBe('')
    query.value = 'first'
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(3)
    fetcher.mockRejectedValueOnce(new Error('Offline'))
    query.value = 'offline'
    await pause()
    expect(state.games.value).toEqual([])
    expect(state.warning.value).toContain('Search unavailable')
    query.value = null
    expect(state.warning.value).toBe('')
})

test('caches belong to each search and are cleared when the authentication session changes', async () => {
    const fetcher = vi.fn(
        async (_url: string, _options: { query?: { q: string }; signal: AbortSignal }) => result,
    )
    fetchBoundary.mockImplementation(fetcher)
    const first = setup('game')
    await pause()
    const second = setup('game')
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(2)
    first.session.value = { id: 'session-2' }
    expect(first.state.games.value).toEqual([])
    expect(second.state.games.value).toEqual([game])
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(3)
})

test('imports use canonical saved data, preserve failures, and ignore responses after authentication changes', async () => {
    const pending = Promise.withResolvers<GameSearchResult>()
    const fetcher = vi.fn().mockReturnValueOnce(pending.promise)
    fetchBoundary.mockImplementation(fetcher)
    const { user, state } = setup()
    const importing = state.importGame(game)
    expect(await state.importGame(game)).toBeUndefined()
    const saved = { ...game, id: 'igdb-1', slug: 'canonical' }
    pending.resolve(saved)
    expect(await importing).toEqual(saved)
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: { igdbId: 1 } })
    expect(await state.importGame(saved)).toEqual(saved)
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockRejectedValueOnce(new Error('Import failed'))
    expect(await state.importGame(game)).toBeUndefined()
    expect(state.warning.value).toContain('Your input has been kept')
    expect(game.id).toBeUndefined()
    const old = Promise.withResolvers<GameSearchResult>()
    fetcher.mockReturnValueOnce(old.promise)
    const cancelled = state.importGame(game)
    user.value = { id: 'bob', role: 'admin' }
    expect(fetcher.mock.calls[2]![1].signal.aborted).toBe(true)
    old.resolve(saved)
    expect(await cancelled).toBeUndefined()
    expect(state.importing.value).toBe(false)
    expect(state.warning.value).toBe('')
})

test('disposal cancels pending searches and imports', async () => {
    const fetcher = vi.fn(
        (_url: string, _options: { signal: AbortSignal }) => new Promise(() => {}),
    )
    fetchBoundary.mockImplementation(fetcher)
    const { scope, state } = setup('game')
    await pause()
    void state.importGame(game)
    scope.stop()
    expect(fetcher.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true)
    const waiting = setup('waiting')
    waiting.scope.stop()
    await pause()
    expect(fetcher).toHaveBeenCalledTimes(2)
})

import assert from 'node:assert/strict'

export const game = { igdbId: 1, slug: 'exact--igdb-slug', name: 'Exact Game', cover: null }
let scenario: string | null = null
let reads = 0
export function configureGameFixture(value: string | null) {
    scenario = value
    reads = 0
}
export async function savedGames() {
    reads++
    return scenario === 'existing' || (scenario === 'simultaneous' && reads > 1)
        ? [{ ...game, id: 'igdb-1', metrics: '[]' }]
        : []
}
export async function queryIgdb() {
    console.info('fixture-igdb-query')
    if (scenario === 'offline') throw new Error('Offline')
    return [{ ...game, igdbId: scenario === 'mismatch' ? 2 : 1 }]
}
export async function createGame(model: string, input: unknown) {
    assert.equal(model, 'games')
    assert.deepEqual(input, { id: 'igdb-1', data: { ...game, metrics: [] } })
    if (scenario === 'simultaneous' || scenario === 'save-failure') throw new Error('Duplicate')
    console.info('fixture-game-created')
}

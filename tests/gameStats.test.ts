import { expect, test } from 'vitest'

import type { GameMetric } from '../shared/types/games'
import { gameValueIssues, formatGameValue } from '../shared/utils/games'
const metrics: GameMetric[] = [
    {
        key: 'peakRank',
        label: 'Highest rank',
        format: 'integer',
        positions: [{ value: 2100, label: 'Immortal 1', color: '#EF4444' }],
    },
    { key: 'winRate', label: 'Win rate', format: 'percent' },
    { key: 'kd', label: 'K/D', format: 'decimal' },
    { key: 'matches', label: 'Matches', format: 'integer' },
]
test('game stats validate configured metrics and preserve zero separately from missing values', () => {
    expect(
        gameValueIssues(metrics, [
            { key: 'winRate', value: 0 },
            { key: 'matches', value: 0 },
        ]),
    ).toEqual([])
    for (const values of [
        [{ key: 'winRate', value: 101 }],
        [{ key: 'matches', value: 1.5 }],
        [{ key: 'kd', value: -1 }],
        [{ key: 'unknown', value: 1 }],
        [
            { key: 'kd', value: 1 },
            { key: 'kd', value: 2 },
        ],
    ])
        expect(gameValueIssues(metrics, values).length).toBeGreaterThan(0)
    expect(formatGameValue(undefined)).toBe('—')
    expect(formatGameValue({ key: 'winRate', value: 0 }, metrics[1])).toBe('0%')
    expect(
        formatGameValue({ key: 'peakRank', value: 2123, label: 'Immortal 1 23 RR' }, metrics[0]),
    ).toBe('Immortal 1 23 RR')
})

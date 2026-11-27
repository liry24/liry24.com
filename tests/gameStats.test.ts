import { expect, test } from 'vitest'

import type { GameMetric } from '../shared/types/games'
import { formatGameValue, gameValueIssues, igdbCoverUrl } from '../shared/utils/games'
const metrics: Array<GameMetric> = [
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

    expect(formatGameValue({ key: 'winRate', value: 0 }, metrics[1])).toBe('0%')
    expect(
        formatGameValue({ key: 'peakRank', value: 2123, label: 'Immortal 1 23 RR' }, metrics[0]),
    ).toBe('Immortal 1 23 RR')
})

test('igdbCoverUrl upgrades IGDB thumbnail URLs and preserves other URLs', () => {
    expect(igdbCoverUrl(undefined)).toBeUndefined()
    expect(igdbCoverUrl(null)).toBeUndefined()
    expect(igdbCoverUrl('https://images.igdb.com/igdb/image/upload/t_thumb/co1234.jpg')).toBe(
        'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1234.jpg',
    )
    expect(
        igdbCoverUrl('https://images.igdb.com/igdb/image/upload/t_thumb/co1234.jpg', 't_cover_big'),
    ).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg')
    expect(igdbCoverUrl('https://example.com/custom-cover.png')).toBe(
        'https://example.com/custom-cover.png',
    )
})

import { expect, test } from 'vitest'

test('collectAdminGameMetrics validates labels, keys, units, primaryMetric, and chart markers', () => {
    const first = createMetricDraft(new Set(), {
        label: 'Peak Rank',
        format: 'integer',
        unit: 'RR',
        positions: [{ value: 2100, label: 'Immortal 1', color: '#FF4655' }],
    })
    const second = createMetricDraft(new Set([first.key]), {
        label: 'Win Rate',
        format: 'percent',
        unit: 'ignored',
    })

    const valid = collectAdminGameMetrics([first, second], first.uid)
    expect(valid.errors).toEqual({})
    expect(valid.primaryMetric).toBe('peak_rank')
    expect(valid.metrics).toEqual([
        {
            key: 'peak_rank',
            label: 'Peak Rank',
            format: 'integer',
            unit: 'RR',
            positions: [{ value: 2100, label: 'Immortal 1', color: '#FF4655', image: undefined }],
        },
        {
            key: 'win_rate',
            label: 'Win Rate',
            format: 'percent',
            unit: undefined,
            positions: [],
        },
    ])

    const duplicate = createMetricDraft(new Set(), {
        key: 'peak_rank',
        label: 'Duplicate',
        format: 'integer',
    })
    duplicate.positions.push({
        uid: 'bad-pos',
        value: '1.5',
        label: '',
        color: 'red',
    })
    const invalid = collectAdminGameMetrics([first, duplicate], first.uid)
    expect(invalid.errors[`gameConfig.metrics.${duplicate.uid}.key`]).toBeTruthy()
    expect(
        invalid.errors[`gameConfig.metrics.${duplicate.uid}.positions.bad-pos.label`],
    ).toBeTruthy()
    expect(
        invalid.errors[`gameConfig.metrics.${duplicate.uid}.positions.bad-pos.value`],
    ).toBeTruthy()
    expect(
        invalid.errors[`gameConfig.metrics.${duplicate.uid}.positions.bad-pos.color`],
    ).toBeTruthy()
})

test('collectAdminStatValuesByUid maps drafts by uid and preserves zero separately from empty', () => {
    const first = createMetricDraft(new Set(), { label: 'Peak Rank', format: 'integer' })
    const second = createMetricDraft(new Set(['peak_rank']), { label: 'K/D', format: 'decimal' })
    const { metrics } = collectAdminGameMetrics([first, second], first.uid)

    const result = collectAdminStatValuesByUid(
        [first, second],
        metrics,
        {
            [first.uid]: { number: '0', label: 'Iron 1' },
            [second.uid]: { number: '' },
        },
        [],
    )
    expect(result.errors).toEqual({})
    expect(result.values).toEqual([
        { key: 'peak_rank', value: 0, label: 'Iron 1', color: undefined, image: undefined },
    ])

    const withUnavailable = collectAdminStatValuesByUid([first], [metrics[0]!], {}, ['stale'])
    expect(withUnavailable.errors['data.values']).toBeTruthy()
})

test('isGameMetricLocked protects published and other draft stats while allowing solo draft edits', () => {
    const meta: GameCatalogMeta = {
        postCount: 0,
        publishedMetricKeys: ['published_key'],
        draftMetricStatIds: {
            solo_draft: ['stat-1'],
            shared_draft: ['stat-1', 'stat-2'],
        },
    }

    expect(isGameMetricLocked(meta, 'published_key', 'stat-1')).toBe(true)
    expect(isGameMetricLocked(meta, 'solo_draft', 'stat-1')).toBe(false)
    expect(isGameMetricLocked(meta, 'solo_draft')).toBe(true)
    expect(isGameMetricLocked(meta, 'shared_draft', 'stat-1')).toBe(true)
    expect(isGameMetricLocked(meta, 'brand_new', 'stat-1')).toBe(false)
})

test('spliceGroupOrder reorders only members of a group without moving other entries', () => {
    const all = ['a1', 'b1', 'a2', 'c1', 'a3']
    expect(spliceGroupOrder(all, ['a1', 'a2', 'a3'], ['a3', 'a1', 'a2'])).toEqual([
        'a3',
        'b1',
        'a1',
        'c1',
        'a2',
    ])
})

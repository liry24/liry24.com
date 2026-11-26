import { createChartScene, renderChartSvg } from '@tanstack/charts'
import type { SceneNode } from '@tanstack/charts'
import { expect, test } from 'vitest'

import { gameChart } from '../app/utils/gameChart'
import type { GameMetric, GamePeriod } from '../shared/types/games'
const metric: GameMetric = {
    key: 'peakRank',
    label: 'Highest rank',
    format: 'integer',
    positions: [
        { value: 2000, label: 'Ascendant' },
        { value: 2100, label: 'Immortal' },
    ],
}
const period = (
    index: number,
    value?: number,
    color = '#22AA66',
    label = 'Saved rank',
): GamePeriod => ({
    periodKey: `act-${index}`,
    period: `Act ${index}`,
    order: index,
    values: value === undefined ? [] : [{ key: 'peakRank', value, label, color }],
})
const flatten = (nodes: ReadonlyArray<SceneNode>): Array<SceneNode> =>
    nodes.flatMap((node) => (node.kind === 'group' ? [node, ...flatten(node.children)] : [node]))
test('out-of-order periods produce a chronological line with the area following its shape', () => {
    const scene = createChartScene(
        gameChart(
            [period(3, 2250, '#EF4444'), period(1, 2000), period(2, 2123, '#EF4444')],
            metric,
            'ranks',
        ),
        { width: 320, height: 280 },
    )
    expect(scene.points.map(({ datum }) => datum)).toMatchObject([
        { period: { order: 1 }, value: 2000 },
        { period: { order: 2 }, value: 2123 },
        { period: { order: 3 }, value: 2250 },
    ])
    const nodes = flatten(scene.nodes)
    const area = nodes.find((node) => node.kind === 'area')
    const line = nodes.find((node) => node.kind === 'polyline')
    expect(line?.path).toBeTruthy()
    expect(area?.path?.startsWith(line?.path ?? '')).toBe(true)
})

function pointLabel(datum: unknown): string | undefined {
    if (typeof datum !== 'object' || datum === null || !('record' in datum)) return undefined

    const { record } = datum
    if (typeof record !== 'object' || record === null || !('label' in record)) return undefined

    return typeof record.label === 'string' ? record.label : undefined
}
test('flat paths remain painted with different recorded colors and equal values retain distinct labels', () => {
    const scene = createChartScene(
        gameChart(
            [period(1, 2100, '#22AA66', 'Ascendant'), period(2, 2100, '#EF4444', 'Immortal')],
            metric,
            'flat',
        ),
        { width: 640, height: 280 },
    )
    const paintedRankLine = flatten(scene.nodes)
        .filter((node) => node.kind === 'rect')
        .find((node) => node.style?.fill?.startsWith('url(#'))
    expect(paintedRankLine?.width).toBeGreaterThan(0)
    expect(paintedRankLine?.height).toBeGreaterThan(0)
    expect(scene.points.map((point) => pointLabel(point.datum))).toEqual(['Ascendant', 'Immortal'])
})
test('missing periods split runs, zero is a value and a single point renders without NaN', () => {
    for (const periods of [[period(1, 2000), period(2), period(3, 2100)], [period(1, 0)], []]) {
        const definition = gameChart(periods, metric, 'gap')
        const scene = createChartScene(definition, { width: 320, height: 280 })
        expect(renderChartSvg(scene, { ariaLabel: 'Ranks' })).not.toMatch(/NaN|Infinity/)
        expect(scene.points).toHaveLength(periods.filter((period) => period.values.length).length)
        expect(definition.gradients).toHaveLength(periods.length === 3 ? 2 : periods.length)
    }
})

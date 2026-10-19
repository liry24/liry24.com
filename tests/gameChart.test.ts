import { createChartScene, renderChartSvg, type SceneNode } from '@tanstack/charts'
import { expect, test } from 'vitest'

import { gameChart } from '../app/utils/gameChart'
import type { GameMetric, GamePeriod } from '../shared/utils/games'
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
const flatten = (nodes: readonly SceneNode[]): SceneNode[] =>
    nodes.flatMap((node) => (node.kind === 'group' ? [node, ...flatten(node.children)] : [node]))
test('area and line use the same monotone path, numeric ordering, rank colors and hidden x labels', () => {
    const definition = gameChart(
        [period(3, 2250, '#EF4444'), period(1, 2000), period(2, 2123, '#EF4444')],
        metric,
        'ranks',
    )
    expect(definition.scales.x.axis).toBe(false)
    expect(definition.gradients[0]?.stops).toEqual([
        { offset: 0, color: '#22AA66' },
        { offset: 0.5, color: '#EF4444' },
        { offset: 1, color: '#EF4444' },
    ])
    for (const width of [320, 800]) {
        const scene = createChartScene(definition, { width, height: 280 })
        const nodes = flatten(scene.nodes)
        const area = nodes.find((node) => node.kind === 'area')
        const line = nodes.find((node) => node.kind === 'polyline')
        expect(line?.kind === 'polyline' && line.path).toContain('C')
        expect(
            area?.kind === 'area' && line?.kind === 'polyline' && area.path?.startsWith(line.path!),
        ).toBe(true)
        expect(scene.points.map((point) => point.datum.record.label)).toContain('Saved rank')
        expect(renderChartSvg(scene, { ariaLabel: 'Ranks', idPrefix: 'first' })).toContain(
            'first-ranks-0',
        )
        expect(renderChartSvg(scene, { ariaLabel: 'Ranks', idPrefix: 'second' })).not.toContain(
            'first-ranks-0',
        )
    }
})
test('flat paths remain painted with different recorded colors and equal values retain distinct labels', () => {
    const scene = createChartScene(
        gameChart(
            [period(1, 2100, '#22AA66', 'Ascendant'), period(2, 2100, '#EF4444', 'Immortal')],
            metric,
            'flat',
        ),
        { width: 640, height: 280 },
    )
    expect(flatten(scene.nodes)).toContainEqual(
        expect.objectContaining({ kind: 'rect', height: 2, style: { fill: 'url(#flat-0)' } }),
    )
    expect(scene.points.map((point) => point.datum.record.label)).toEqual(['Ascendant', 'Immortal'])
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

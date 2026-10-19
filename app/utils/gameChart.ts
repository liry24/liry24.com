import { chartCurves } from '@nuxt/ui/utils/chart'
import { areaY, defineChart, dot, lineY, type ChartMark, type SceneNode } from '@tanstack/charts'
import { crosshair } from '@tanstack/charts/crosshair'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import type { GameMetric, GamePeriod, GameValue } from '~~/shared/utils/games'

export type RankPoint = { x: string; value: number; record: GameValue; period: GamePeriod }
// SVG object-bounding-box gradients have no paint on a perfectly horizontal path.
function horizontalGradient(mark: ChartMark): ChartMark {
    return {
        ...mark,
        initialize(context) {
            const initialized = mark.initialize(context)
            return {
                ...initialized,
                render(context) {
                    const scene = initialized.render(context)
                    const paint = (node: SceneNode): SceneNode => {
                        if (node.kind === 'group')
                            return { ...node, children: node.children.map(paint) }
                        if (
                            node.kind !== 'polyline' ||
                            node.points.length < 2 ||
                            !node.points.every((point) => point[1] === node.points[0]![1])
                        )
                            return node
                        const first = node.points[0]!,
                            last = node.points.at(-1)!
                        return {
                            kind: 'group',
                            key: `${node.key}-flat`,
                            children: [
                                {
                                    kind: 'rect',
                                    key: `${node.key}-paint`,
                                    x: first[0],
                                    y: first[1] - 1,
                                    width: last[0] - first[0],
                                    height: 2,
                                    radius: 1,
                                    style: { fill: node.style?.stroke },
                                },
                                { ...node, style: { ...node.style, strokeOpacity: 0 } },
                            ],
                        }
                    }
                    return { ...scene, nodes: scene.nodes.map(paint) }
                },
            }
        },
    }
}
export function gameChart(periods: GamePeriod[], metric: GameMetric, id: string) {
    const ordered = [...periods].sort((a, b) => a.order - b.order)
    const runs: RankPoint[][] = []
    let run: RankPoint[] = []
    for (const period of ordered) {
        const record = period.values.find((value) => value.key === metric.key)
        if (!record) {
            if (run.length) runs.push(run)
            run = []
            continue
        }
        run.push({ x: period.periodKey, value: record.value, record, period })
    }
    if (run.length) runs.push(run)
    const gradients = runs.map((points, index) => ({
        id: `${id}-${index}`,
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0,
        stops: points.map((point, p) => ({
            offset: points.length > 1 ? p / (points.length - 1) : 0,
            color: point.record.color || '#94a3b8',
        })),
    }))
    return defineChart({
        marks: [
            ...runs.flatMap((points, index) => {
                const paint = `url(#${gradients[index]!.id})`
                return [
                    decorative(
                        areaY(points, {
                            x: 'x',
                            y1: 0,
                            y2: 'value',
                            curve: chartCurves.monotone,
                            fill: paint,
                            fillOpacity: 0.15,
                        }),
                    ),
                    ...points.map((point) =>
                        decorative(
                            dot([point], {
                                x: 'x',
                                y: 'value',
                                r: 2.5,
                                fill: point.record.color || '#94a3b8',
                            }),
                        ),
                    ),
                    horizontalGradient(
                        lineY(points, {
                            x: 'x',
                            y: 'value',
                            curve: chartCurves.monotone,
                            stroke: paint,
                            strokeWidth: 2,
                            points: false,
                        }),
                    ),
                ]
            }),
            crosshair({ x: true, y: false }),
        ],
        scales: {
            x: {
                scale: () =>
                    scalePoint()
                        .domain(ordered.map((period) => period.periodKey))
                        .padding(0),
                axis: false,
            },
            y: {
                scale: scaleLinear,
                nice: true,
                grid: true,
                axis: {
                    label: metric.label,
                    ticks: metric.positions?.length
                        ? {
                              values: [
                                  ...new Set(metric.positions.map((position) => position.value)),
                              ],
                              format: (value: number) =>
                                  metric.positions?.find((position) => position.value === value)
                                      ?.label ?? String(value),
                          }
                        : undefined,
                },
            },
        },
        gradients,
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
    })
}

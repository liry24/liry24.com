import { chartCurves } from '@nuxt/ui/utils/chart'
import { areaY, defineChart, dot, lineY } from '@tanstack/charts'
import type { ChartMark, SceneNode } from '@tanstack/charts'
import { crosshair } from '@tanstack/charts/crosshair'
import { decorative } from '@tanstack/charts/mark/decorative'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'

export type RankPoint = { x: string; value: number; record: GameValue; period: GamePeriod }
// SVG object-bounding-box gradients have no paint on a perfectly horizontal path.
const horizontalGradient = (mark: ChartMark): ChartMark => ({
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

                    if (node.kind !== 'polyline' || node.points.length < 2) return node

                    const first = node.points[0]
                    const last = node.points.at(-1)
                    if (!first || !last || !node.points.every((point) => point[1] === first[1]))
                        return node

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
})

export function gameChart(periods: Array<GamePeriod>, metric: GameMetric, id: string) {
    const ordered = [...periods].sort((a, b) => a.order - b.order)
    const periodLabels = new Map(ordered.map((period) => [period.periodKey, period.period]))
    const runs: Array<Array<RankPoint>> = []
    let run: Array<RankPoint> = []
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

    const allValues = runs.flatMap((points) => points.map((point) => point.value))
    const dataMin = allValues.length ? Math.min(...allValues) : 0
    const dataMax = allValues.length ? Math.max(...allValues) : 0
    const span = dataMax - dataMin
    const zoomed = span > 0 && dataMin > span * 1.5
    const rawStep = span > 0 ? 10 ** Math.floor(Math.log10(span)) : 1
    const step = span / rawStep < 3 ? rawStep / 2 : rawStep
    const baseline = zoomed ? Math.max(0, Math.floor((dataMin - span * 0.35) / step) * step) : 0
    const yMax = zoomed ? Math.ceil((dataMax + span * 0.15) / step) * step : undefined
    const visiblePositions = metric.positions?.length
        ? metric.positions.filter(
              (position) =>
                  position.value >= baseline &&
                  position.value <= (yMax ?? Math.ceil(dataMax + (span || dataMax * 0.1 || 1))),
          )
        : []

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
                const gradient = gradients[index]
                const paint = gradient ? `url(#${gradient.id})` : '#94a3b8'
                return [
                    decorative(
                        areaY(points, {
                            x: 'x',
                            y1: baseline,
                            y2: 'value',
                            curve: chartCurves.monotone,
                            fill: paint,
                            fillOpacity: 0.22,
                        }),
                    ),
                    ...points.map((point) =>
                        decorative(
                            dot([point], {
                                x: 'x',
                                y: 'value',
                                r: 3.5,
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
                            strokeWidth: 2.5,
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
                axis: ordered.length
                    ? {
                          ticks: {
                              format: (value: string) => periodLabels.get(value) ?? value,
                          },
                      }
                    : false,
            },
            y: {
                scale:
                    yMax !== undefined ? () => scaleLinear().domain([baseline, yMax]) : scaleLinear,
                nice: yMax === undefined,
                grid: true,
                axis: {
                    ticks: visiblePositions.length
                        ? {
                              values: [
                                  ...new Set(visiblePositions.map((position) => position.value)),
                              ],
                              format: (value: number) =>
                                  visiblePositions.find((position) => position.value === value)
                                      ?.label ?? String(value),
                          }
                        : {
                              format: (value: number) =>
                                  formatGameValue({ key: metric.key, value }, metric),
                          },
                },
            },
        },
        gradients,
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
    })
}

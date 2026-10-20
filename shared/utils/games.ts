import type { AssetInput } from 'liti'
export type GamePosition = {
    value: number
    label: string
    image?: AssetInput | null
    color?: string | null
}
export type GameMetric = {
    key: string
    label: string
    format: 'integer' | 'decimal' | 'percent'
    unit?: string | null
    positions?: GamePosition[] | null
}
export type GameValue = {
    key: string
    value: number
    label?: string | null
    image?: AssetInput | null
    color?: string | null
}
export type GameData = {
    slug: string
    igdbId: number
    name: string
    cover?: string | null
    icon?: AssetInput | null
    primaryMetric?: string | null
    metrics?: GameMetric[] | null
}
export type GamePeriod = {
    period: string
    periodKey: string
    order: number
    values: GameValue[]
    href?: string | null
}
export const gameSlugPattern = /^[a-z0-9][a-z0-9-]*$/
export const gameColorPattern = /^#[0-9a-fA-F]{6}$/
export const metricKeyPattern = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/
export const gameImageUrl = (image: unknown): string | undefined =>
    image && typeof image === 'object' && 'url' in image ? String(image.url) : undefined
export function formatGameValue(value: GameValue | undefined, metric?: GameMetric): string {
    if (!value) return '—'
    if (value.label) return value.label
    return (
        new Intl.NumberFormat('ja', {
            maximumFractionDigits: metric?.format === 'integer' ? 0 : 2,
        }).format(value.value) +
        (metric?.format === 'percent' ? '%' : metric?.unit ? ` ${metric.unit}` : '')
    )
}
export function gameValueIssues(metrics: GameMetric[], values: GameValue[]): string[] {
    const issues: string[] = [],
        seen = new Set<string>()
    for (const value of values) {
        const metric = metrics.find((item) => item.key === value.key)
        if (!metric || seen.has(value.key)) issues.push(`Unknown or repeated metric: ${value.key}`)
        seen.add(value.key)
        if (
            !Number.isFinite(value.value) ||
            value.value < 0 ||
            (metric?.format === 'integer' && !Number.isSafeInteger(value.value)) ||
            (metric?.format === 'percent' && value.value > 100)
        )
            issues.push(`Invalid value: ${value.key}`)
        if (value.color && !gameColorPattern.test(value.color))
            issues.push(`Invalid color: ${value.key}`)
    }
    return issues
}

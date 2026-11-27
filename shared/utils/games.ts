import type { GameMetric, GameValue } from '../types/games.js'

export const gameSlugPattern = /^[a-z0-9][a-z0-9-]*$/
export const gameColorPattern = /^#[0-9a-fA-F]{6}$/

const igdbThumbPrefix = 'https://images.igdb.com/igdb/image/upload/t_thumb/'

export function igdbCoverUrl(
    cover: string | null | undefined,
    size: 't_cover_big' | 't_cover_big_2x' = 't_cover_big_2x',
): string | undefined {
    if (!cover) return undefined
    if (cover.startsWith(igdbThumbPrefix))
        return `https://images.igdb.com/igdb/image/upload/${size}/${cover.slice(igdbThumbPrefix.length)}`
    return cover
}

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

export function gameValueIssues(
    metrics: Array<GameMetric>,
    values: Array<GameValue>,
): Array<string> {
    const issues: Array<string> = [],
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

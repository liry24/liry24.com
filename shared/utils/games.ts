import type { GameMetric, GameValue } from '../types/games.js'

export const gameSlugPattern = /^[a-z0-9][a-z0-9-]*$/
export const gameColorPattern = /^#[0-9a-fA-F]{6}$/
export const gameMetricKeyPattern = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

const integerFormatter = new Intl.NumberFormat('ja', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('ja', { maximumFractionDigits: 2 })

export function deriveGameMetricKey(label: string, existingKeys: ReadonlySet<string>): string {
    const ascii = label
        .normalize('NFKD')
        .replaceAll(/\p{M}/gu, '')
        .replaceAll(/([a-z0-9])([A-Z])/gu, '$1_$2')
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '_')
        .replaceAll(/^_+|_+$/gu, '')
    const base = (/^[a-z]/u.test(ascii) ? ascii : ascii ? `m_${ascii}` : 'metric').slice(0, 56)

    if (!existingKeys.has(base)) return base

    for (let suffix = 2; ; suffix++) {
        const suffixText = `_${suffix}`
        const candidate = `${base.slice(0, 64 - suffixText.length)}${suffixText}`
        if (!existingKeys.has(candidate)) return candidate
    }
}

export function formatGameValue(value: GameValue | undefined, metric?: GameMetric): string {
    if (!value) return '—'

    if (value.label) return value.label

    const formatter = metric?.format === 'integer' ? integerFormatter : decimalFormatter
    return (
        formatter.format(value.value) +
        (metric?.format === 'percent' ? '%' : metric?.unit ? ` ${metric.unit}` : '')
    )
}

export function gameValueIssues(
    metrics: Array<GameMetric>,
    values: Array<GameValue>,
): Array<string> {
    const issues: Array<string> = [],
        seen = new Set<string>()
    const metricsByKey = new Map<string, GameMetric>()
    for (const metric of metrics) {
        if (!metricsByKey.has(metric.key)) metricsByKey.set(metric.key, metric)
    }

    for (const value of values) {
        const metric = metricsByKey.get(value.key)
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

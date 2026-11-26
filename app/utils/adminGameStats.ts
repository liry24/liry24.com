export type AdminStatValue = GameStatsRecordData['values'][number]
export type AdminStatDraft = Omit<AdminStatValue, 'key' | 'value'> & { number: string }

export function collectAdminStatValues(
    metrics: Array<GameMetric>,
    drafts: Record<string, AdminStatDraft>,
) {
    const values: Array<AdminStatValue> = []
    const errors: Record<string, string> = {}
    const keys = new Set(metrics.map((metric) => metric.key))
    if (Object.keys(drafts).some((key) => !keys.has(key)))
        errors['data.values'] = 'Remove unavailable metrics before saving.'

    for (const metric of metrics) {
        const draft = drafts[metric.key]
        if (!draft) continue
        const input = draft.number.trim()
        const label = draft.label?.trim() || undefined
        const color = draft.color?.trim() || undefined
        const image = draft.image
        const path = `data.values.${metric.key}`
        if (!input) {
            if (label || color || image) errors[path] = 'Enter a value to use the display settings.'
            continue
        }
        const value = Number(input)
        if (
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(input) ||
            gameValueIssues([metric], [{ key: metric.key, value }]).length
        ) {
            errors[path] =
                metric.format === 'percent'
                    ? 'Enter a percentage from 0 to 100.'
                    : metric.format === 'integer'
                      ? 'Enter a non-negative whole number within the safe integer range.'
                      : 'Enter a finite, non-negative number.'
        }
        if (color && !gameColorPattern.test(color))
            errors[`${path}.color`] = 'Use a hex color such as #2563EB.'
        values.push({ key: metric.key, value, label, color, image })
    }
    return { values, errors }
}

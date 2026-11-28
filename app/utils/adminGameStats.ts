type AdminStatValue = GameStatsRecordData['values'][number]
type AdminMetricRecord = GameRecordData['metrics'][number]
type AdminMetricPosition = AdminMetricRecord['positions'][number]

export type AdminStatDraft = Omit<AdminStatValue, 'key' | 'value'> & { number: string }

export interface AdminMetricPositionDraft {
    uid: string
    value: string
    label: string
    color: string
    image?: MediaReference
}

export interface AdminMetricDraft {
    uid: string
    key: string
    autoKey: boolean
    label: string
    format: GameMetric['format']
    unit: string
    positions: Array<AdminMetricPositionDraft>
}

const numericInputPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu

let draftCounter = 0

export function nextDraftUid(prefix: string): string {
    draftCounter += 1
    return `${prefix}-${draftCounter}`
}

export function createMetricPositionDraft(
    position?: Partial<AdminMetricPosition>,
): AdminMetricPositionDraft {
    return {
        uid: nextDraftUid('pos'),
        value: position?.value !== undefined ? String(position.value) : '',
        label: position?.label ?? '',
        color: position?.color ?? '',
        image: position?.image,
    }
}

export function createMetricDraft(
    existingKeys: ReadonlySet<string>,
    overrides?: Partial<Pick<AdminMetricRecord, 'key' | 'label' | 'format' | 'unit' | 'positions'>>,
): AdminMetricDraft {
    const label = overrides?.label ?? ''
    const hasExplicitKey = Boolean(overrides?.key)
    const key = overrides?.key ?? (label.trim() ? deriveGameMetricKey(label, existingKeys) : '')
    return {
        uid: nextDraftUid('metric'),
        key,
        autoKey: !hasExplicitKey,
        label,
        format: overrides?.format ?? 'integer',
        unit: overrides?.unit ?? '',
        positions: (overrides?.positions ?? []).map((position) =>
            createMetricPositionDraft(position),
        ),
    }
}

export function toMetricDrafts(metrics: ReadonlyArray<GameMetric>): Array<AdminMetricDraft> {
    return metrics.map((metric) => ({
        uid: nextDraftUid('metric'),
        key: metric.key,
        autoKey: false,
        label: metric.label,
        format: metric.format,
        unit: metric.unit ?? '',
        positions: (metric.positions ?? []).map((position) =>
            createMetricPositionDraft({
                value: position.value,
                label: position.label,
                color: position.color ?? undefined,
                image: position.image ?? undefined,
            }),
        ),
    }))
}

export function isGameMetricLocked(
    meta: GameCatalogMeta | undefined,
    metricKey: string,
    editingStatId?: string,
): boolean {
    if (!meta || !metricKey) return false
    if (meta.publishedMetricKeys.includes(metricKey)) return true
    const draftIds = meta.draftMetricStatIds[metricKey] ?? []
    return editingStatId ? draftIds.some((id) => id !== editingStatId) : draftIds.length > 0
}

function metricValueErrorMessage(format: GameMetric['format']): string {
    if (format === 'percent') return 'Enter a percentage from 0 to 100.'
    if (format === 'integer')
        return 'Enter a non-negative whole number within the safe integer range.'
    return 'Enter a finite, non-negative number.'
}

export function collectAdminGameMetrics(
    drafts: ReadonlyArray<AdminMetricDraft>,
    primaryUid: string | undefined,
) {
    const metrics: Array<AdminMetricRecord> = []
    const keyByUid: Record<string, string> = {}
    const errors: Record<string, string> = {}
    const usedKeys = new Set<string>()

    if (drafts.length > 30) errors['gameConfig.metrics'] = 'At most 30 metrics are supported.'

    for (const draft of drafts) {
        const basePath = `gameConfig.metrics.${draft.uid}`
        const label = draft.label.trim()
        if (!label) errors[`${basePath}.label`] = 'Enter a metric label.'

        const explicitKey = draft.key.trim()
        const key = explicitKey || (label ? deriveGameMetricKey(label, usedKeys) : '')
        if (!key || !gameMetricKeyPattern.test(key)) {
            errors[`${basePath}.key`] =
                'Start with a letter and use only letters, numbers, and underscores.'
        } else if (usedKeys.has(key)) errors[`${basePath}.key`] = 'Metric keys must be unique.'
        else usedKeys.add(key)

        const unit = draft.format === 'percent' ? undefined : draft.unit.trim() || undefined
        const positions: Array<AdminMetricPosition> = []

        if (draft.positions.length > 100)
            errors[`${basePath}.positions`] = 'At most 100 chart markers are supported.'

        for (const position of draft.positions) {
            const posPath = `${basePath}.positions.${position.uid}`
            const posLabel = position.label.trim()
            const posValueInput = position.value.trim()
            const posColor = position.color.trim() || undefined
            if (!posLabel && !posValueInput && !posColor && !position.image) continue

            if (!posLabel) errors[`${posPath}.label`] = 'Enter a marker label.'

            const numericValue = Number(posValueInput)
            const tempMetric: GameMetric = {
                key: key || 'metric',
                label: label || 'Metric',
                format: draft.format,
                unit,
            }
            if (
                !posValueInput ||
                !numericInputPattern.test(posValueInput) ||
                gameValueIssues([tempMetric], [{ key: tempMetric.key, value: numericValue }]).length
            )
                errors[`${posPath}.value`] = metricValueErrorMessage(draft.format)

            if (posColor && !gameColorPattern.test(posColor))
                errors[`${posPath}.color`] = 'Use a hex color such as #2563EB.'

            positions.push({
                label: posLabel,
                value: Number.isFinite(numericValue) ? numericValue : 0,
                color: posColor,
                image: position.image,
            })
        }

        keyByUid[draft.uid] = key
        metrics.push({
            key,
            label,
            format: draft.format,
            unit,
            positions,
        })
    }

    const primaryMetric =
        primaryUid && keyByUid[primaryUid] && metrics.some((m) => m.key === keyByUid[primaryUid])
            ? keyByUid[primaryUid]
            : undefined

    return { metrics, primaryMetric, keyByUid, errors }
}

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
            !numericInputPattern.test(input) ||
            gameValueIssues([metric], [{ key: metric.key, value }]).length
        )
            errors[path] = metricValueErrorMessage(metric.format)

        if (color && !gameColorPattern.test(color))
            errors[`${path}.color`] = 'Use a hex color such as #2563EB.'
        values.push({ key: metric.key, value, label, color, image })
    }
    return { values, errors }
}

export function collectAdminStatValuesByUid(
    metricDrafts: ReadonlyArray<AdminMetricDraft>,
    metrics: ReadonlyArray<GameMetric>,
    statDraftsByUid: Record<string, AdminStatDraft>,
    unavailableKeys: ReadonlyArray<string> = [],
) {
    const values: Array<AdminStatValue> = []
    const errors: Record<string, string> = {}
    if (unavailableKeys.length > 0)
        errors['data.values'] = 'Remove unavailable metrics before saving.'

    for (const [index, metricDraft] of metricDrafts.entries()) {
        const metric = metrics[index]
        const draft = statDraftsByUid[metricDraft.uid]
        if (!metric || !draft) continue
        const input = draft.number.trim()
        const label = draft.label?.trim() || undefined
        const color = draft.color?.trim() || undefined
        const image = draft.image
        const path = `data.values.${metricDraft.uid}`
        if (!input) {
            if (label || color || image) errors[path] = 'Enter a value to use the display settings.'
            continue
        }
        const value = Number(input)
        if (
            !numericInputPattern.test(input) ||
            gameValueIssues([metric], [{ key: metric.key, value }]).length
        )
            errors[path] = metricValueErrorMessage(metric.format)

        if (color && !gameColorPattern.test(color))
            errors[`${path}.color`] = 'Use a hex color such as #2563EB.'
        if (metric.key) values.push({ key: metric.key, value, label, color, image })
    }
    return { values, errors }
}

export function spliceGroupOrder(
    allIds: ReadonlyArray<string>,
    groupIds: ReadonlyArray<string>,
    nextGroupIds: ReadonlyArray<string>,
): Array<string> {
    if (groupIds.length !== nextGroupIds.length) return [...allIds]
    const memberSet = new Set(groupIds)
    let cursor = 0
    return allIds.map((id) => {
        if (!memberSet.has(id)) return id
        return nextGroupIds[cursor++] ?? id
    })
}

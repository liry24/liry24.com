export const toLocalDatetimeInput = (iso: string | undefined): string => {
    if (!iso) return ''

    const ms = Date.parse(iso)
    if (Number.isNaN(ms)) return ''

    const offset = new Date(ms).getTimezoneOffset() * 60 * 1000
    return new Date(ms - offset).toISOString().slice(0, 16)
}

export const toIsoFromLocalInput = (local: string): string | undefined => {
    if (!local.trim()) return undefined

    const parsed = new Date(local)
    if (Number.isNaN(parsed.getTime())) return undefined

    return parsed.toISOString()
}

export const defaultScheduleLocalInput = (): string =>
    toLocalDatetimeInput(new Date(Date.now() + 3_600_000).toISOString())

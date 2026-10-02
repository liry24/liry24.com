export const parseAvatarSize = (value: string | undefined) => {
    if (value === undefined) return 2048
    if (!/^\d+$/u.test(value)) return null

    const size = Number(value)
    return Number.isSafeInteger(size) && size > 0 && size <= 2048 ? size : null
}

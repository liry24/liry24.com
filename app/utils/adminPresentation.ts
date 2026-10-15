export function adminAssetId(value: unknown): string | undefined {
    if (Array.isArray(value)) value = value[0]
    const id =
        typeof value === 'string'
            ? value
            : value && typeof value === 'object' && 'id' in value
              ? value.id
              : undefined
    return typeof id === 'string' && id ? id : undefined
}

interface SealedSecret {
    unseal: () => string
}

function isSealedSecret(value: unknown): value is SealedSecret {
    return (
        typeof value === 'object' &&
        value !== null &&
        'unseal' in value &&
        typeof value.unseal === 'function'
    )
}

export function readSecretValue(value: unknown): string | undefined {
    if (typeof value === 'string') return value || undefined

    if (isSealedSecret(value)) {
        const unsealed = value.unseal()
        return unsealed || undefined
    }
    return undefined
}

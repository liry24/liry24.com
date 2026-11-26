export function adminErrorMessage(cause: unknown, fallback: string) {
    if (cause && typeof cause === 'object' && 'data' in cause) {
        const data = cause.data
        if (
            data &&
            typeof data === 'object' &&
            'message' in data &&
            typeof data.message === 'string'
        )
            return data.message
    }
    return cause instanceof Error ? cause.message : fallback
}

export const parseCsvList = (value: string | undefined): Array<string> =>
    (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

export const normalizeIssuer = (value: string | undefined): string =>
    (value || 'https://sso.liry24.com').replace(/\/+$/u, '')

export function resolveAuthBaseUrl(
    origin: string,
    runtimeSiteUrl: string | undefined,
    isSynthetic: boolean,
    appEnv: string | undefined,
): string {
    if (origin === 'https://liry24.com' || origin === 'https://dev-liry24-com.liry.workers.dev')
        return origin

    try {
        const parsed = new URL(origin)
        if (
            isSynthetic &&
            parsed.protocol === 'http:' &&
            (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
        )
            return parsed.origin

        if (
            appEnv !== 'production' &&
            parsed.protocol === 'https:' &&
            parsed.hostname.endsWith('.workers.dev')
        )
            return parsed.origin
    } catch {
        // Fall back to configured URL below
    }
    return runtimeSiteUrl || 'https://liry24.com'
}

export function buildTrustedOrigins(authBaseUrl: string): Array<string> {
    return Array.from(
        new Set(['https://liry24.com', 'https://dev-liry24-com.liry.workers.dev', authBaseUrl]),
    )
}

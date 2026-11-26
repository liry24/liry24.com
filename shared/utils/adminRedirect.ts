const adminPath = /^\/admin(?:\/|$)/iu
export const pocketIdErrorParam = 'pocket-id-error'

export function isAdminPath(pathname: string) {
    return adminPath.test(pathname)
}

export function adminRedirect(value: unknown) {
    if (
        typeof value !== 'string' ||
        !value.startsWith('/') ||
        value.startsWith('//') ||
        /[\\\s]/u.test(value)
    ) {
        return '/admin'
    }
    const origin = 'https://admin.invalid'
    const url = new URL(value, origin)
    return url.origin === origin && isAdminPath(url.pathname)
        ? `${url.pathname}${url.search}${url.hash}`
        : '/admin'
}

export function pocketIdRetryPath(value: string) {
    const url = new URL(adminRedirect(value), 'https://admin.invalid')
    url.searchParams.delete(pocketIdErrorParam)
    url.searchParams.delete('error')
    url.searchParams.delete('error_description')
    return url.pathname + url.search + url.hash
}

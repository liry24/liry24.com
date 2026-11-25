const adminPath = /^\/admin(?:\/|$)/iu

export function isAdminPath(pathname: string) {
    return adminPath.test(pathname)
}

export function adminRedirect(value: unknown) {
    if (typeof value !== 'string' || !value.startsWith('/') || /[\\\s]/u.test(value)) {
        return '/admin'
    }
    const origin = 'https://admin.invalid'
    const url = new URL(value, origin)
    return url.origin === origin && isAdminPath(url.pathname)
        ? `${url.pathname}${url.search}${url.hash}`
        : '/admin'
}

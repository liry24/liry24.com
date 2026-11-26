const iconIdPattern = /^[a-z0-9-]+:[a-z0-9-]+$/u

export async function searchIconify(
    query: string,
    signal: AbortSignal,
    prefix?: string,
): Promise<Array<string>> {
    const url = new URL('https://api.iconify.design/search')
    url.search = new URLSearchParams({ query, limit: '32' }).toString()
    if (prefix) url.searchParams.set('prefix', prefix)

    const response = await fetch(url, { signal, credentials: 'omit' })
    if (!response.ok) throw new Error('Iconify search failed.')
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('icons' in data) || !Array.isArray(data.icons))
        throw new Error('Invalid Iconify search response.')

    return data.icons.filter((id): id is string => typeof id === 'string' && iconIdPattern.test(id))
}

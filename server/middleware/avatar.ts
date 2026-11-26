const AVATAR_REGEX = /^\/avatar\.(png|jpg|jpeg|webp)$/i

const formatToWsrv = new Map<string, string>([
    ['jpeg', 'jpg'],
    ['jpg', 'jpg'],
    ['png', 'png'],
    ['webp', 'webp'],
])

export default defineEventHandler(async (event) => {
    const match = event.url.pathname.match(AVATAR_REGEX)
    const output = match?.[1] ? formatToWsrv.get(match[1].toLowerCase()) : undefined
    if (!output) return

    const query = getQuery(event)
    const rawSize =
        typeof query.size === 'string'
            ? query.size
            : typeof query.s === 'string'
              ? query.s
              : undefined
    const size = parseAvatarSize(rawSize)
    if (!size) throw createError({ status: 400, statusText: 'Bad Request' })

    const params = new URLSearchParams({
        url: 'https://images.liry24.com/avatar.png',
        w: String(size),
        h: String(size),
        fit: 'inside',
        output,
    })

    const upstream = await fetch(`https://wsrv.nl/?${params}&we`)

    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
        },
    })
})

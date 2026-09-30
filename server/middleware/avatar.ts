const AVATAR_REGEX = /^\/avatar\.(png|jpg|jpeg|webp)$/i

const formatToWsrv = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    webp: 'webp',
} as const

type AvatarFormat = keyof typeof formatToWsrv

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig(event)
    const path = getRequestURL(event).pathname
    const match = path.match(AVATAR_REGEX)

    if (!match) return

    const format = match[1]!.toLowerCase() as AvatarFormat

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
        url: `${config.public.imagesDomain}/avatar.png`,
        w: String(size),
        h: String(size),
        fit: 'inside',
        output: formatToWsrv[format],
    })

    const upstream = await fetch(`https://wsrv.nl/?${params}&we`)

    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
        },
    })
})

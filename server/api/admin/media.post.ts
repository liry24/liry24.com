const mimeExtensions = new Map<string, string>([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
    ['image/avif', 'avif'],
    ['image/gif', 'gif'],
])

const allowedFolders = new Set(['posts', 'works', 'arts', 'games', 'uploads'])
const maxFileBytes = 10 * 1024 * 1024

export default defineEventHandler(async (event): Promise<MediaReference> => {
    await requireAdminSession(event)
    const formData = await event.req.formData()
    const fileEntry = formData.get('file')
    if (!fileEntry || typeof fileEntry === 'string')
        throw createError({ status: 400, statusText: 'Image file is required' })

    const extension = mimeExtensions.get(fileEntry.type)
    if (!extension) {
        throw createError({
            status: 400,
            statusText: 'Unsupported image format. Use PNG, JPEG, WebP, AVIF, or GIF.',
        })
    }

    if (fileEntry.size <= 0 || fileEntry.size > maxFileBytes) {
        throw createError({
            status: 400,
            statusText: 'Image must be between 1 byte and 10 MB.',
        })
    }

    const rawFolder = String(formData.get('folder') ?? getQuery(event).folder ?? 'uploads')
    const folder = allowedFolders.has(rawFolder) ? rawFolder : 'uploads'
    const baseName = fileEntry.name
        .replace(/\.[^.]+$/u, '')
        .toLowerCase()
        .replaceAll(/[^a-z0-9_-]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '')
        .slice(0, 48)
    const pathname = `${folder}/${crypto.randomUUID()}-${baseName || 'image'}.${extension}`

    const bytes = new Uint8Array(await fileEntry.arrayBuffer())
    const [putError, stored] = await blob.put(pathname, bytes, {
        contentType: fileEntry.type,
    })
    if (putError || !stored) {
        throw createError({
            status: 500,
            statusText: 'Could not upload image.',
            cause: putError,
        })
    }

    return {
        pathname: stored.pathname,
        contentType: stored.contentType || fileEntry.type,
        size: stored.size ?? bytes.byteLength,
    }
})

import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import { blob } from 'vite-hub/blob'

import type { MediaReference } from '../../../shared/schemas/content.js'
import { requireAdminSession } from '../../utils/auth.js'

function extensionForMime(mimeType: string): string | undefined {
    switch (mimeType) {
        case 'image/png': {
            return 'png'
        }
        case 'image/jpeg': {
            return 'jpg'
        }
        case 'image/webp': {
            return 'webp'
        }
        case 'image/avif': {
            return 'avif'
        }
        case 'image/gif': {
            return 'gif'
        }
        default: {
            return undefined
        }
    }
}

const allowedFolders = new Set(['posts', 'works', 'arts', 'games', 'ranks', 'uploads'])
const maxFileBytes = 10 * 1024 * 1024

interface UploadLikeFile {
    name: string
    type: string
    size: number
    arrayBuffer: () => Promise<ArrayBuffer>
}

function isUploadFile(value: unknown): value is UploadLikeFile {
    return Boolean(
        value &&
        typeof value === 'object' &&
        'arrayBuffer' in value &&
        typeof value.arrayBuffer === 'function' &&
        'type' in value &&
        typeof value.type === 'string' &&
        'size' in value &&
        typeof value.size === 'number' &&
        'name' in value &&
        typeof value.name === 'string',
    )
}

export default defineEventHandler(async (event): Promise<MediaReference> => {
    await requireAdminSession(event)
    const formData = await event.req.formData()
    const fileEntry = formData.get('file')
    if (!isUploadFile(fileEntry)) {
        throw createError({ status: 400, statusText: 'Image file is required' })
    }

    const extension = extensionForMime(fileEntry.type)
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

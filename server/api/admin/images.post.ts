import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import { blob } from 'vite-hub/blob'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
    await assertAppOrigin(event.req)
    const model = z
        .string()
        .regex(/^[a-z][a-zA-Z0-9]*$/)
        .safeParse(getQuery(event).model)
    if (!model.success) throw createError({ status: 400, statusText: 'Invalid model' })
    await requireAdminPermission(event, { [`liti:model:${model.data}`]: ['save'] })
    const length = Number(event.req.headers.get('content-length'))
    if (!Number.isSafeInteger(length) || length < 1 || length > 16 * 1024 * 1024)
        throw createError({ status: 413, statusText: 'Upload at most 16 MB per request' })
    const [error, files] = await blob.handleUpload(
        { req: event.req },
        {
            ensure: { types: ['image'], maxSize: '8MB' },
            put: { prefix: 'uploads', addRandomSuffix: true },
        },
    )
    if (error) throw createError({ status: 400, statusText: 'Image upload failed', cause: error })
    return files.map(({ pathname, contentType, size }) => ({ pathname, contentType, size }))
})

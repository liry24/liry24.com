import { z } from 'zod'

import content from '#server/content'

const collectionSchema = z.enum(contentCollectionNames)

const publishPayloadSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('publish'),
        collection: collectionSchema,
        id: z.string().min(1),
        digest: z.string().nullable().optional(),
        message: z.string().optional(),
    }),
    z.object({
        action: z.literal('schedule'),
        collection: collectionSchema,
        id: z.string().min(1),
        at: z.iso.datetime({ offset: true }),
        digest: z.string().nullable().optional(),
        message: z.string().optional(),
    }),
    z.object({
        action: z.literal('unschedule'),
        scheduleId: z.string().min(1),
    }),
])

function rethrowContentError(error: unknown): never {
    const code =
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : ''
    const message =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
            ? error.message
            : 'Content action failed.'

    if (code === 'WORKSPACE_CONFLICT')
        throw createError({ status: 409, statusText: message, message, cause: error })

    if (code === 'CONTENT_NOT_FOUND')
        throw createError({ status: 404, statusText: message, message, cause: error })

    if (code === 'CONTENT_INVALID' || code === 'CONTENT_R0011')
        throw createError({ status: 400, statusText: message, message, cause: error })

    throw createError({ status: 500, statusText: message, message, cause: error })
}

async function validatePostGameReferences(id: string, digest: string) {
    const post = await content.collection('posts').get(id, { ref: 'draft' })
    if (post?.digest !== digest) {
        throw createError({
            status: 409,
            statusText: 'The post draft changed. Save it again before publishing.',
        })
    }

    if (!post.data.gameMentions?.length) return post

    const gameIds = await gameCatalog().existingIds(post.data.gameMentions)
    if (post.data.gameMentions.some((gameId) => !gameIds.has(gameId))) {
        throw createError({
            status: 400,
            statusText:
                'Save the post again so every mentioned game is registered before publishing.',
        })
    }
    return post
}

export default defineEventHandler(async (event) => {
    const session = await requireAdminSession(event)
    const parsed = publishPayloadSchema.safeParse(await readBody(event))
    if (!parsed.success) {
        throw createError({
            status: 400,
            statusText: 'Invalid publish payload',
            message: parsed.error.issues[0]?.message || 'Invalid publish payload.',
        })
    }

    const input = parsed.data
    try {
        if (input.action === 'unschedule') {
            await content.unschedule(input.scheduleId, {
                metadata: { actorUserId: session.user.id },
            })
            return { ok: true }
        }

        if (input.action === 'schedule' && Date.parse(input.at) <= Date.now())
            throw createError({ status: 400, statusText: 'Choose a future publication time.' })

        let digest = input.digest
        if (digest === undefined) {
            const status = await content.collection(input.collection).status(input.id)
            if (!status) throw createError({ status: 404, statusText: 'Document not found' })

            digest = status.draft
        }

        if (input.collection === 'posts' && digest) {
            const post = await validatePostGameReferences(input.id, digest)
            if (!post.issues?.length) digest = await preparePostSlug(post)
        }
        const expect = [{ collection: input.collection, id: input.id, digest }]

        if (input.action === 'publish') {
            const result = await content.publish({
                expect,
                message: input.message,
                metadata: { actorUserId: session.user.id },
            })
            return { ok: true, result }
        }

        const schedule = await content.schedule({
            at: input.at,
            expect,
            message: input.message,
            metadata: { actorUserId: session.user.id },
        })
        return { ok: true, schedule }
    } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) throw error

        rethrowContentError(error)
    }
})

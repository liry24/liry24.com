import type { ContentPublishExpectation } from '@vite-hub/content'
import { createError, defineEventHandler, readBody } from 'nuxt/server'
import { z } from 'zod'

import { contentCollectionNames } from '../../../../shared/schemas/content.js'
import content from '../../../content.js'
import { requireAdminSession } from '../../../utils/auth.js'

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

    if (code === 'WORKSPACE_CONFLICT') {
        throw createError({ status: 409, statusText: message, message, cause: error })
    }
    if (code === 'CONTENT_NOT_FOUND') {
        throw createError({ status: 404, statusText: message, message, cause: error })
    }
    if (code === 'CONTENT_INVALID' || code === 'CONTENT_R0011') {
        throw createError({ status: 400, statusText: message, message, cause: error })
    }
    throw createError({ status: 500, statusText: message, message, cause: error })
}

async function postGameExpectations(
    id: string,
    digest: string,
): Promise<Array<ContentPublishExpectation>> {
    const post = await content.collection('posts').get(id, { ref: 'draft' })
    if (post?.digest !== digest) {
        throw createError({
            status: 409,
            statusText: 'The post draft changed. Save it again before publishing.',
        })
    }

    const games = content.collection('games')
    const dependencies = await Promise.all(
        [...new Set(post.data.gameMentions)].map(async (gameId) => {
            const game = await games.status(gameId)
            if (game?.published) {
                return []
            }
            if (!game?.draft) {
                throw createError({
                    status: 400,
                    statusText: 'Import every mentioned game before publishing.',
                })
            }
            return [{ collection: 'games', id: gameId, digest: game.draft }]
        }),
    )
    return dependencies.flat()
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

        let digest = input.digest
        if (digest === undefined) {
            const status = await content.collection(input.collection).status(input.id)
            if (!status) {
                throw createError({ status: 404, statusText: 'Document not found' })
            }
            digest = status.draft
        }

        const expect: Array<ContentPublishExpectation> = [
            { collection: input.collection, id: input.id, digest },
        ]
        if (input.collection === 'posts' && digest) {
            expect.push(...(await postGameExpectations(input.id, digest)))
        }

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
        if (error && typeof error === 'object' && 'statusCode' in error) {
            throw error
        }
        rethrowContentError(error)
    }
})

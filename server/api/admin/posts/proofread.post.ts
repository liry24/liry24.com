import { ModelError } from '@litijs/model'
import { defineEventHandler, createError, readBody } from 'nuxt/server'
import { runAgent } from 'vite-hub/agent'
import { z } from 'zod'

import postProofread from '../../../agents/post-proofread'

const inputSchema = z.strictObject({ body: z.string().min(1).max(500_000) })
export default defineEventHandler(async (event) => {
    await assertAppOrigin(event.req)
    const session = await requireAdminPermission(event, { 'liti:model:posts': ['save'] })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ status: 415, statusText: 'JSON required' })
    const input = inputSchema.safeParse(await readBody(event))
    if (!input.success) throw createError({ status: 400, statusText: 'Invalid proofreading input' })
    const [error, proposal] = await runAgent(postProofread, {
        data: input.data,
        abortSignal: event.req.signal,
        timeout: 60_000,
        context: { actor: { id: session.user.id } },
    })
    const output = inputSchema.safeParse(proposal)
    if (error || !output.success)
        throw createError({
            status: 502,
            statusText: 'Proofreading failed. Your draft is unchanged.',
        })
    try {
        return await validatePostProofreading(input.data.body, output.data.body)
    } catch (cause) {
        if (!(cause instanceof ModelError) || cause.code !== 'LITI_INVALID_INPUT') throw cause
        throw createError({
            status: 422,
            statusText: 'Proofreading changed protected content.',
            cause,
        })
    }
})

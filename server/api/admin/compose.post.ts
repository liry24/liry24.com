import { defineEventHandler, createError, readBody } from 'nuxt/server'
import { z } from 'zod'

import runtime from '#liti/runtime'

import { evaluateClef, type ComposerInference } from '../../utils/clef'
import { listAdminEntries } from '../../utils/entryList'

export default defineEventHandler(async (event) => {
    const started = performance.now()
    await assertAppOrigin(event.req)
    const session = await requireAdminPermission(event, { adminPanel: ['compose'] })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ status: 415, statusText: 'JSON required' })
    const allowed = await runtime.descriptors(session.user)
    const authorizationMs = performance.now() - started
    const input = composerRequest.safeParse(await readBody(event))
    if (!input.success) throw createError({ status: 400, statusText: 'Invalid composer input' })
    const models = await composerModelInfo(allowed.map((model) => runtime.definition(model.name)))
    if (!models.length) throw createError({ status: 403, statusText: 'No models available' })
    const allowedModels = new Set(models.map((model) => model.name))
    const requestedModels = [...(input.data.items ?? []), input.data.context]
    if (
        requestedModels.some((selection) => selection?.model && !allowedModels.has(selection.model))
    )
        throw createError({ status: 403, statusText: 'Model unavailable' })
    const binding = z
        .object({
            env: z.object({
                AI: z.custom<ComposerInference>(
                    (value) =>
                        value !== null &&
                        typeof value === 'object' &&
                        'run' in value &&
                        typeof value.run === 'function',
                ),
            }),
        })
        .safeParse(event.context.cloudflare)
    if (!binding.success)
        throw createError({
            status: 503,
            statusText: 'Composer inference is unavailable. Use the regular form.',
        })
    const inference = binding.data.env.AI
    const inferences: { durationMs: number; questionCount: number; payloadBytes: number }[] = []
    let lookupMs = 0,
        activeLookups = 0,
        lookupStarted = 0
    async function lookup<T>(read: () => Promise<T>): Promise<T> {
        if (activeLookups++ === 0) lookupStarted = performance.now()
        try {
            return await read()
        } finally {
            if (--activeLookups === 0) lookupMs += performance.now() - lookupStarted
        }
    }
    const encoder = new TextEncoder()
    event.res.headers.set('Cache-Control', 'private, no-store')
    event.res.headers.set('Server-Timing', 'authorize;dur=' + authorizationMs.toFixed(1))
    try {
        return await composeAdminRequest(
            input.data,
            {
                models,
                list: (model, q, signal) =>
                    lookup(async () => {
                        signal.throwIfAborted()
                        const page = await listAdminEntries(model, session.user, {
                            q,
                            limit: 5,
                            offset: 0,
                        })
                        signal.throwIfAborted()
                        return page
                    }),
                get: (model, id) =>
                    lookup(async () => {
                        const definition = runtime.definition(model)
                        const entry =
                            definition.storage === 'content'
                                ? await runtime.content.readDraft(
                                      model,
                                      id,
                                      { actor: session.user },
                                      definition.locales?.default,
                                  )
                                : await runtime.records.readDraft(model, id, {
                                      actor: session.user,
                                  })
                        if (!entry)
                            throw createError({ status: 404, statusText: 'Entry unavailable' })
                        return entry
                    }),
            },
            async (request) => {
                const measurement = {
                    durationMs: 0,
                    questionCount: Object.keys(request.questions).length,
                    payloadBytes: encoder.encode(
                        JSON.stringify({
                            model: 'clef-flash',
                            state: request.state,
                            questions: request.questions,
                        }),
                    ).byteLength,
                }
                inferences.push(measurement)
                const inferenceStart = performance.now()
                try {
                    return await evaluateClef(request, inference)
                } finally {
                    measurement.durationMs = performance.now() - inferenceStart
                }
            },
            event.req.signal,
        )
    } catch (error) {
        if (event.req.signal.aborted) throw error
        const limited = error instanceof Error && error.name === 'UsageLimit'
        const timedOut = error instanceof Error && error.name === 'TimeoutError'
        throw createError({
            status: limited ? 429 : timedOut ? 504 : 502,
            statusText: limited
                ? 'AI usage limit reached. You can continue with the regular form.'
                : timedOut
                  ? 'The request timed out. You can continue with the regular form.'
                  : 'Could not prepare the form. Try again or choose a content type.',
        })
    } finally {
        console.info('admin-compose', {
            authorizationMs,
            lookupMs: lookupMs + (activeLookups ? performance.now() - lookupStarted : 0),
            inferenceMs: inferences.reduce((total, item) => total + item.durationMs, 0),
            inferenceCalls: inferences.length,
            inferences,
            totalMs: performance.now() - started,
        })
    }
})

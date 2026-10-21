import { useAdmin } from 'liti/nuxt/server'
import { defineEventHandler, createError, readBody } from 'nuxt/server'
import { UsageLimit } from 'void/limits'

export default defineEventHandler(async (event) => {
    const started = performance.now()
    await requireAdminPermission(event, { adminPanel: ['compose'] })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ statusCode: 415, statusMessage: 'JSON required' })
    const admin = useAdmin(event)
    const allowed = await admin.models()
    const authorizationMs = performance.now() - started
    const input = composerRequest.safeParse(await readBody(event))
    if (!input.success)
        throw createError({ statusCode: 400, statusMessage: 'Invalid composer input' })
    const models = composerModelInfo(allowed)
    if (!models.length) throw createError({ statusCode: 403, statusMessage: 'No models available' })
    const allowedModels = new Set(models.map((model) => model.name))
    const requestedModels = [...(input.data.items ?? []), input.data.context]
    if (
        requestedModels.some((selection) => selection?.model && !allowedModels.has(selection.model))
    )
        throw createError({ statusCode: 403, statusMessage: 'Model unavailable' })
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
                    lookup(() =>
                        admin.entries.list(model, {
                            q,
                            limit: 5,
                            locale: input.data.locale,
                            signal,
                        }),
                    ),
                get: (model, id) => lookup(() => admin.entries.get(model, id)),
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
                    return await evaluateClef(request)
                } finally {
                    measurement.durationMs = performance.now() - inferenceStart
                }
            },
            event.req.signal,
        )
    } catch (error) {
        if (event.req.signal.aborted) throw error
        const limited = error instanceof UsageLimit
        const timedOut = error instanceof Error && error.name === 'TimeoutError'
        throw createError({
            statusCode: limited ? 429 : timedOut ? 504 : 502,
            message: limited
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

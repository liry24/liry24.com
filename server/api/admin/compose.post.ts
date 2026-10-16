import { getNitroRequest } from '@liria24/site-admin/internal/runtime/nitro2'
import { useAdmin } from '@liria24/site-admin/server'
import { defineEventHandler, createError, readBody } from 'nuxt/server'
import { UsageLimit } from 'void/limits'

import {
    composerModels,
    composerRequest,
    type ComposerField,
} from '../../../shared/utils/adminComposer'
import config from '../../../site-admin.config'
import { composeAdmin } from '../../ai/adminComposer'
import { evaluateClef } from '../../ai/clef'

export default defineEventHandler(async (event) => {
    const started = performance.now()
    await requireUserSession(getNitroRequest(event), { user: { role: 'admin' } })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
        throw createError({ statusCode: 415, statusMessage: 'JSON required' })
    const admin = useAdmin(event)
    const allowed = await admin.models()
    const authorizationMs = performance.now() - started
    const input = composerRequest.safeParse(await readBody(event))
    if (!input.success)
        throw createError({ statusCode: 400, statusMessage: 'Invalid composer input' })
    const models = composerModels
        .filter((name) => allowed.some((model) => model.name === name))
        .map((name) => ({
            name,
            label: config.models[name].meta.label,
            displayField: config.models[name].displayFields.title,
            features: allowed.find((model) => model.name === name)!.features,
            scheduling:
                !('scheduling' in config.models[name]) || config.models[name].scheduling !== false,
            fields: Object.entries(config.models[name].fields)
                .filter(([key, field]) =>
                    name === 'posts' ? ['title', 'tags'].includes(key) : field.kind !== 'object',
                )
                .map(([key, field]): ComposerField => ({
                    key,
                    kind: field.kind,
                    label: typeof field.label === 'string' ? field.label : key,
                    required: field.required,
                    hasDefault: 'default' in field && field.default !== undefined,
                    values: 'values' in field ? (field.values as readonly string[]) : undefined,
                })),
        }))
    if (!models.length) throw createError({ statusCode: 403, statusMessage: 'No models available' })
    if (input.data.model && !models.some((model) => model.name === input.data.model))
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
    const abort = new AbortController()
    const signal = AbortSignal.any([event.req.signal, abort.signal, AbortSignal.timeout(5000)])
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            try {
                for await (const item of composeAdmin(
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
                    signal,
                )) {
                    signal.throwIfAborted()
                    controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'))
                }
            } catch (error) {
                if (abort.signal.aborted || event.req.signal.aborted) return
                const message =
                    error instanceof UsageLimit
                        ? 'AI usage limit reached. You can continue with the regular form.'
                        : signal.aborted
                          ? 'The request timed out. You can continue with the regular form.'
                          : 'Could not prepare the form. Try again or choose a content type.'
                controller.enqueue(
                    encoder.encode(JSON.stringify({ type: 'error', message }) + '\n'),
                )
            } finally {
                console.info('admin-compose', {
                    authorizationMs,
                    lookupMs: lookupMs + (activeLookups ? performance.now() - lookupStarted : 0),
                    inferenceMs: inferences.reduce((total, item) => total + item.durationMs, 0),
                    inferenceCalls: inferences.length,
                    inferences,
                    totalMs: performance.now() - started,
                })
                if (!abort.signal.aborted) controller.close()
            }
        },
        cancel() {
            abort.abort()
        },
    })
    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'Server-Timing': 'authorize;dur=' + authorizationMs.toFixed(1),
        },
    })
})

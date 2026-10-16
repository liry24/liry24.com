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
    // Authorizes through the existing admin/Preview GitHub permission hook before inference.
    const allowed = await admin.models()
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
    const authorizationMs = performance.now() - started
    let inferenceMs = 0,
        inferenceCalls = 0,
        lookupMs = 0
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
                        list: async (model, q, signal) => {
                            const lookupStart = performance.now()
                            const page = await admin.entries.list(model, {
                                q,
                                limit: 5,
                                locale: input.data.locale,
                                signal,
                            })
                            lookupMs += performance.now() - lookupStart
                            return page
                        },
                        get: (model, id) => admin.entries.get(model, id),
                    },
                    async (request) => {
                        const inferenceStart = performance.now()
                        inferenceCalls++
                        try {
                            return await evaluateClef(request)
                        } finally {
                            inferenceMs += performance.now() - inferenceStart
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
                    lookupMs,
                    inferenceMs,
                    inferenceCalls,
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

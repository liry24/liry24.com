import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test'
import { defineAgent } from 'vite-hub/agent'
import { content } from 'vite-hub/agent/capabilities'
import { webChat } from 'vite-hub/agent/channels'
import { authenticated } from 'vite-hub/auth/agent'
import { useAuth } from 'vite-hub/auth/server'
import { useServerEnv } from 'vite-hub/env'

import { isAdminUser } from '../utils/auth.js'
import { readSecretValue } from '../utils/secret.js'

const GEMINI_MODEL_ID = 'gemini-4-hydrogen'

function createOfflineMockModel(): MockLanguageModelV4 {
    const replyText =
        'Content assistant ready (offline test mode). Draft edits with content tools first and confirm before publishing or scheduling.'

    const finishReason = { unified: 'stop' as const, raw: 'stop' }
    const usage = {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 12, text: 12, reasoning: 0 },
    }

    return new MockLanguageModelV4({
        provider: 'google.generative-ai',
        modelId: GEMINI_MODEL_ID,
        doGenerate: {
            content: [{ type: 'text' as const, text: replyText }],
            finishReason,
            usage,
            warnings: [],
        },
        doStream: async () => ({
            stream: convertArrayToReadableStream([
                { type: 'stream-start' as const, warnings: [] },
                { type: 'text-start' as const, id: 'text-0' },
                { type: 'text-delta' as const, id: 'text-0', delta: replyText },
                { type: 'text-end' as const, id: 'text-0' },
                { type: 'finish' as const, finishReason, usage },
            ]),
        }),
    })
}

function readGoogleApiKey(): string | undefined {
    try {
        const key = readSecretValue(useServerEnv().GOOGLE_GENERATIVE_AI_API_KEY)
        if (key) {
            return key
        }
    } catch {
        // Fallback when running outside generated Nitro/Vite env bridge.
    }
    const processValue = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    return typeof processValue === 'string' && processValue ? processValue : undefined
}

async function resolveAdminSession(request: Request) {
    const session = await useAuth(request).api.getSession({ headers: request.headers })
    if (!session?.user) {
        return null
    }
    if (!isAdminUser(session.user)) {
        throw Object.assign(new Error('Administrator role required.'), {
            status: 403,
            statusCode: 403,
        })
    }
    return session
}

export default defineAgent({
    name: 'assistant',
    description: 'Single-owner editorial assistant for liry24.com collections and posts.',
    invoker: authenticated({
        required: true,
        message: 'Sign in as the site owner to use the editorial assistant.',
        source: async ({ request }) => (request ? resolveAdminSession(request) : null),
    }),
    capabilities: [content()],
    channels: {
        web: webChat({
            route: {
                admission: {
                    authenticate: async ({ request }) =>
                        (await resolveAdminSession(request)) ?? false,
                },
            },
        }),
    },
    driver: {
        instructions: [
            'You are the editorial assistant for liry24.com (Japanese and English supported).',
            'You can inspect, draft, update, publish, and schedule documents across the site collections:',
            'posts, works, arts, careers, skills, games, gameStats, ranks, and socials.',
            'Always save changes as drafts first, verify fields match collection schemas, and ask for explicit confirmation before publishing or scheduling.',
        ].join('\n'),
        execution: {
            callSettings: {
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingLevel: 'low',
                        },
                    },
                },
            },
        },
        model: (): LanguageModel => {
            const synthetic =
                process.env.LIRY24_TEST_LOCAL === 'true' || process.env.APP_ENV === 'test'
            const apiKey = readGoogleApiKey()
            if (synthetic || !apiKey) {
                return createOfflineMockModel()
            }
            const google = createGoogleGenerativeAI({ apiKey })
            return google(GEMINI_MODEL_ID)
        },
    },
})

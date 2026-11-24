import { createIgdbClient, eq, IgdbError } from '@liry24/igdb'
import type { IgdbClient, IgdbClientOptions } from '@liry24/igdb'
import { log } from 'evlog'
import { createError } from 'nuxt/server'
import { useServerEnv } from 'vite-hub/env'
import { z } from 'zod'

import { readSecretValue } from './secret.js'

interface IgdbCredentials {
    client?: string
    secret?: string
}

type IgdbFetch = NonNullable<IgdbClientOptions['fetch']>

function readIgdbCredentials(): IgdbCredentials {
    try {
        const env = useServerEnv()
        const client =
            typeof env.IGDB_CLIENT_ID === 'string' && env.IGDB_CLIENT_ID
                ? env.IGDB_CLIENT_ID
                : process.env.IGDB_CLIENT_ID
        const secret = readSecretValue(env.IGDB_CLIENT_SECRET) ?? process.env.IGDB_CLIENT_SECRET
        return { client, secret }
    } catch {
        return {
            client: process.env.IGDB_CLIENT_ID,
            secret: process.env.IGDB_CLIENT_SECRET,
        }
    }
}

function createIgdbFetch(): IgdbFetch {
    return async (input, init) => {
        const rejectRedirects = init?.redirect === 'error'
        const nextInit = rejectRedirects ? { ...init, redirect: 'manual' as const } : init
        const response = await globalThis.fetch(input, nextInit)
        // workerd throws TypeError on redirect: "error", so reject 3xx responses under manual mode.
        if (rejectRedirects && response.status >= 300 && response.status < 400) {
            if (response.body) {
                await response.body.cancel().catch(() => undefined)
            }
            throw new TypeError('IGDB upstream returned an unexpected redirect.')
        }
        return response
    }
}

function logIgdbFailure(error: unknown, credentials: { client: string; secret: string }): void {
    if (error instanceof IgdbError) {
        log.error({
            event: 'igdb.request_failed',
            code: error.code,
            phase: error.phase,
            status: error.status ?? null,
            retryAfter: error.retryAfter ?? null,
            message: error.message,
        })
        return
    }
    const rawMessage = error instanceof Error ? error.message : String(error)
    log.error({
        event: 'igdb.unexpected_error',
        name: error instanceof Error ? error.name : 'UnknownError',
        message: rawMessage
            .replaceAll(credentials.client, '[redacted]')
            .replaceAll(credentials.secret, '[redacted]'),
    })
}

const result = z.array(
    z.object({
        id: z.number().int().positive(),
        slug: z.string().regex(gameSlugPattern),
        name: z.string().min(1),
        cover: z.object({ image_id: z.string().regex(/^[a-zA-Z0-9_]+$/) }).optional(),
    }),
)

let cached: { clientId: string; clientSecret: string; client: IgdbClient } | undefined

export async function queryIgdb(
    query: { search: string } | { id: number },
): Promise<Array<GameSearchResult>> {
    const { client, secret } = readIgdbCredentials()

    if (!client || !secret) {
        log.error({
            event: 'igdb.credentials_missing',
            hasClientId: Boolean(client),
            hasClientSecret: Boolean(secret),
        })
        throw createError({
            status: 503,
            statusText: 'IGDB search is not configured. Saved games are still available.',
        })
    }

    let response: Array<unknown>
    try {
        if (!cached || cached.clientId !== client || cached.clientSecret !== secret) {
            cached = {
                clientId: client,
                clientSecret: secret,
                client: createIgdbClient({
                    clientId: client,
                    clientSecret: secret,
                    timeoutMs: 5000,
                    fetch: createIgdbFetch(),
                }),
            }
        }
        const games = cached.client.query('games').fields('id', 'slug', 'name', 'cover.image_id')
        response = await ('id' in query
            ? games.where((game) => eq(game.id, query.id)).limit(1)
            : games.search(query.search).limit(10))
    } catch (error) {
        logIgdbFailure(error, { client, secret })
        throw createError({
            status: 502,
            statusText: 'IGDB is unavailable. Continue writing or choose a saved game.',
        })
    }

    const parsed = result.safeParse(response)
    if (!parsed.success) {
        log.error({
            event: 'igdb.response_invalid',
            issueCount: parsed.error.issues.length,
            issues: parsed.error.issues.slice(0, 5).map((issue) => ({
                path: issue.path.join('.'),
                code: issue.code,
                message: issue.message,
            })),
        })
        throw createError({
            status: 502,
            statusText: 'IGDB is unavailable. Continue writing or choose a saved game.',
        })
    }

    return parsed.data.map((game) => ({
        igdbId: game.id,
        slug: game.slug,
        name: game.name,
        cover: game.cover
            ? `https://images.igdb.com/igdb/image/upload/t_thumb/${game.cover.image_id}.jpg`
            : null,
    }))
}

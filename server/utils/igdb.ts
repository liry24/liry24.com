import { createIgdbClient, eq, IgdbError } from '@liry24/igdb'
import type { IgdbClientOptions } from '@liry24/igdb'
import { log } from 'evlog'
import { z } from 'zod'

interface IgdbCredentials {
    client?: string
    secret?: string
}

interface CachedIgdbToken {
    clientId: string
    clientSecret: string
    accessToken: string
    expiresAt: number
}

type IgdbFetch = NonNullable<IgdbClientOptions['fetch']>
type IgdbQuery = { search: string } | { id: number } | { slug: string }

const IGDB_TIMEOUT_MS = 5000

function readIgdbCredentials(): IgdbCredentials {
    try {
        const env = useServerEnv()
        const client =
            typeof env.IGDB_CLIENT_ID === 'string' && env.IGDB_CLIENT_ID
                ? env.IGDB_CLIENT_ID
                : readProcessEnv('IGDB_CLIENT_ID')
        const secret =
            readSecretValue(env.IGDB_CLIENT_SECRET) ?? readProcessEnv('IGDB_CLIENT_SECRET')
        return { client, secret }
    } catch {
        return {
            client: readProcessEnv('IGDB_CLIENT_ID'),
            secret: readProcessEnv('IGDB_CLIENT_SECRET'),
        }
    }
}

async function fetchWithoutRedirects(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const rejectRedirects = init?.redirect === 'error'
    const nextInit = rejectRedirects ? { ...init, redirect: 'manual' as const } : init
    const response = await globalThis.fetch(input, nextInit)
    // workerd throws TypeError on redirect: "error", so reject 3xx responses under manual mode.
    if (rejectRedirects && response.status >= 300 && response.status < 400) {
        if (response.body) await response.body.cancel().catch(() => undefined)

        throw new TypeError('IGDB upstream returned an unexpected redirect.')
    }
    return response
}

function createIgdbFetch(): IgdbFetch {
    return (input, init) => fetchWithoutRedirects(input, init)
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

const twitchTokenSchema = z.object({
    access_token: z.string().refine((value) => value.trim().length > 0 && !/[\r\n]/.test(value)),
    expires_in: z.number().finite().positive(),
})

const result = z.array(
    z.object({
        id: z.number().int().positive(),
        slug: z.string().regex(gameSlugPattern),
        name: z.string().min(1),
        cover: z.object({ image_id: z.string().regex(/^[a-zA-Z0-9_]+$/) }).optional(),
    }),
)

// Cache only plain token data across requests; never store Promises or stateful clients across requests in workerd.
let cachedToken: CachedIgdbToken | undefined

async function fetchTwitchAccessToken(
    clientId: string,
    clientSecret: string,
): Promise<CachedIgdbToken> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), IGDB_TIMEOUT_MS)
    try {
        let response: Response
        try {
            response = await fetchWithoutRedirects('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials',
                }),
                redirect: 'error',
                signal: controller.signal,
            })
        } catch {
            throw new IgdbError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', 'auth')
        }

        if (!response.ok) {
            if (response.body) await response.body.cancel().catch(() => undefined)

            throw new IgdbError('HTTP_ERROR', 'auth', { status: response.status })
        }

        let payload: unknown
        try {
            payload = await response.json()
        } catch {
            throw new IgdbError(controller.signal.aborted ? 'TIMEOUT' : 'INVALID_RESPONSE', 'auth')
        }

        const parsed = twitchTokenSchema.safeParse(payload)
        if (!parsed.success) throw new IgdbError('INVALID_RESPONSE', 'auth')

        const expiresMs = parsed.data.expires_in * 1000
        return {
            clientId,
            clientSecret,
            accessToken: parsed.data.access_token,
            expiresAt: Date.now() + expiresMs - Math.min(60_000, expiresMs / 10),
        }
    } finally {
        clearTimeout(timer)
    }
}

async function resolveIgdbAccessToken(
    clientId: string,
    clientSecret: string,
    forceRefresh = false,
): Promise<{ token: string; fromCache: boolean }> {
    if (
        !forceRefresh &&
        cachedToken &&
        cachedToken.clientId === clientId &&
        cachedToken.clientSecret === clientSecret &&
        cachedToken.expiresAt > Date.now()
    )
        return { token: cachedToken.accessToken, fromCache: true }

    const fresh = await fetchTwitchAccessToken(clientId, clientSecret)
    cachedToken = fresh
    return { token: fresh.accessToken, fromCache: false }
}

async function runIgdbQuery(
    clientId: string,
    accessToken: string,
    query: IgdbQuery,
): Promise<Array<unknown>> {
    const client = createIgdbClient({
        clientId,
        accessToken,
        timeoutMs: IGDB_TIMEOUT_MS,
        fetch: createIgdbFetch(),
    })
    const games = client.query('games').fields('id', 'slug', 'name', 'cover.image_id')
    if ('id' in query) return await games.where((game) => eq(game.id, query.id)).limit(1)

    if ('slug' in query) return await games.where((game) => eq(game.slug, query.slug)).limit(1)

    return await games.search(query.search).limit(10)
}

async function executeIgdbQuery(
    clientId: string,
    clientSecret: string,
    query: IgdbQuery,
): Promise<Array<unknown>> {
    const { token, fromCache } = await resolveIgdbAccessToken(clientId, clientSecret)
    try {
        return await runIgdbQuery(clientId, token, query)
    } catch (error) {
        if (
            fromCache &&
            error instanceof IgdbError &&
            error.code === 'HTTP_ERROR' &&
            error.status === 401
        ) {
            if (cachedToken?.accessToken === token) cachedToken = undefined

            const refreshed = await resolveIgdbAccessToken(clientId, clientSecret, true)
            return await runIgdbQuery(clientId, refreshed.token, query)
        }
        throw error
    }
}

export async function queryIgdb(query: IgdbQuery): Promise<Array<GameSearchResult>> {
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
        response = await executeIgdbQuery(client, secret, query)
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

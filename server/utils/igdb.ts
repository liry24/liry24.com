import { createIgdbClient, createMemoryTokenCache, eq, IgdbError } from '@liry24/igdb'
import type { IgdbClient } from '@liry24/igdb'
import { log } from 'evlog'
import { z } from 'zod'

interface IgdbCredentials {
    client?: string
    secret?: string
}

type IgdbQuery = { search: string } | { id: number } | { slug: string }

const IGDB_TIMEOUT_MS = 5000

// Cache only plain token data across requests; never store Promises or stateful clients across requests in workerd.
const tokenCache = createMemoryTokenCache()
let emulatorLogged = false

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

function isNonProductionRuntime(): boolean {
    return (
        (import.meta.dev && !readProcessEnv('VITEST')) ||
        readProcessEnv('LIRY24_TEST_LOCAL') === 'true' ||
        readProcessEnv('APP_ENV') === 'test'
    )
}

export function isIgdbEmulatorEnabled(credentials?: IgdbCredentials): boolean {
    if (!isNonProductionRuntime()) return false

    if (readProcessEnv('LIRY24_IGDB_EMULATOR') === 'true') return true

    const resolved = credentials ?? readIgdbCredentials()
    return import.meta.dev && !readProcessEnv('VITEST') && (!resolved.client || !resolved.secret)
}

function logIgdbFailure(error: unknown, credentials: IgdbCredentials): void {
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
    let sanitized = error instanceof Error ? error.message : String(error)
    if (credentials.client) sanitized = sanitized.replaceAll(credentials.client, '[redacted]')
    if (credentials.secret) sanitized = sanitized.replaceAll(credentials.secret, '[redacted]')

    log.error({
        event: 'igdb.unexpected_error',
        name: error instanceof Error ? error.name : 'UnknownError',
        message: sanitized,
    })
}

const resultSchema = z.array(
    z.object({
        id: z.number().int().positive(),
        slug: z.string().regex(gameSlugPattern),
        name: z.string().min(1),
        cover: z.object({ image_id: z.string().regex(/^[a-zA-Z0-9_]+$/) }).optional(),
    }),
)

async function resolveIgdbClient(
    credentials: IgdbCredentials,
): Promise<{ client: IgdbClient; source: GameSearchSource }> {
    if (isIgdbEmulatorEnabled(credentials)) {
        if (!emulatorLogged) {
            emulatorLogged = true
            log.info({ event: 'igdb.emulator_active' })
        }
        const { createIgdbEmulator } = await import('@liry24/igdb/emulator')
        return {
            client: createIgdbClient({
                emulator: createIgdbEmulator(),
                timeoutMs: IGDB_TIMEOUT_MS,
            }),
            source: 'emulator',
        }
    }

    if (!credentials.client || !credentials.secret) {
        log.error({
            event: 'igdb.credentials_missing',
            hasClientId: Boolean(credentials.client),
            hasClientSecret: Boolean(credentials.secret),
        })
        throw createError({
            status: 503,
            statusText: 'IGDB search is not configured. Saved games are still available.',
        })
    }

    return {
        client: createIgdbClient({
            clientId: credentials.client,
            clientSecret: credentials.secret,
            tokenCache,
            timeoutMs: IGDB_TIMEOUT_MS,
        }),
        source: 'igdb',
    }
}

async function runIgdbQuery(client: IgdbClient, query: IgdbQuery): Promise<Array<unknown>> {
    const games = client.query('games').fields('id', 'slug', 'name', 'cover.image_id')
    if ('id' in query) return await games.where((game) => eq(game.id, query.id)).limit(1)

    if ('slug' in query) return await games.where((game) => eq(game.slug, query.slug)).limit(1)

    return await games.search(query.search).limit(10)
}

export async function queryIgdbWithSource(
    query: IgdbQuery,
): Promise<{ games: Array<GameSearchResult>; source: GameSearchSource }> {
    const credentials = readIgdbCredentials()
    const { client, source } = await resolveIgdbClient(credentials)

    let response: Array<unknown>
    try {
        response = await runIgdbQuery(client, query)
    } catch (error) {
        logIgdbFailure(error, credentials)
        throw createError({
            status: 502,
            statusText: 'IGDB is unavailable. Continue writing or choose a saved game.',
        })
    }

    const parsed = resultSchema.safeParse(response)
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

    return {
        source,
        games: parsed.data.map((game) => ({
            igdbId: game.id,
            slug: game.slug,
            name: game.name,
            cover: game.cover
                ? `https://images.igdb.com/igdb/image/upload/t_thumb/${game.cover.image_id}.jpg`
                : null,
        })),
    }
}

export async function queryIgdb(query: IgdbQuery): Promise<Array<GameSearchResult>> {
    return (await queryIgdbWithSource(query)).games
}

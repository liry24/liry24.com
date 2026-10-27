import {
    ModelError,
    type AuthorizationContext,
    type ModelSaveInput,
    type ModelValidationContext,
} from '@litijs/model'
import { eq } from 'drizzle-orm'

import type { GameMetric, GameValue } from '../../shared/types/games.js'
import { adminRoles, modelAccess } from '../../shared/utils/authAccess.js'
import { gameTitleParts, postGameSlugs } from '../../shared/utils/gameMentions.js'
import { gameValueIssues } from '../../shared/utils/games.js'

export const modelAuthorization = ({ actor, model, action }: AuthorizationContext) => {
    if (actor.id === 'liry24:publish-due' && actor.role === 'system') return action === 'publish'
    const resource = `liti:model:${model}`
    if (!Object.hasOwn(modelAccess, resource) || actor.role !== 'admin') return false
    return adminRoles.admin.authorize({ [resource]: [action] }).success
}
const invalid = (path: string, message: string): never => {
    throw new ModelError('LITI_INVALID_INPUT', message, [{ path: [path], message }])
}
async function database() {
    const [{ db }, { tables }] = await Promise.all([
        import('vite-hub/database/drizzle'),
        import('../database/records.js'),
    ])
    return { db, schema: tables }
}

export async function preparePostGames(
    input: ModelSaveInput,
    context: ModelValidationContext,
): Promise<ModelSaveInput> {
    const data = { ...input.data }
    const body = input.body ?? context.body ?? ''
    const slugs = await postGameSlugs(String(data.title ?? ''), body)
    const games = await Promise.all(
        slugs.map(async (slug) => {
            const { db, schema } = await database()
            const [row] = await db.select().from(schema.games).where(eq(schema.games.slug, slug))
            return row ? { id: row.id, data: row } : undefined
        }),
    )
    if (games.some((game) => !game))
        invalid('gameMentions', 'Choose an imported game for every game mention.')
    data.plainTitle = gameTitleParts(String(data.title ?? ''))
        .map((part) => games.find((game) => game?.data.slug === part.slug)?.data.name ?? part.text)
        .join('')
    data.gameMentions = games.map((game) => game!.id)
    data.authorUserId = context.previous?.authorUserId ?? context.actor.id
    return { ...input, data }
}

export async function validateGameRecord(
    data: Record<string, unknown>,
    context: ModelValidationContext,
): Promise<void> {
    const metrics = data.metrics as GameMetric[]
    if (new Set(metrics.map((item) => item.key)).size !== metrics.length)
        invalid('metrics', 'Metric keys must be unique.')
    if (data.primaryMetric && !metrics.some((item) => item.key === data.primaryMetric))
        invalid('primaryMetric', 'Choose an existing metric.')
    for (const metric of metrics)
        for (const position of metric.positions ?? [])
            for (const message of gameValueIssues([metric], [{ ...position, key: metric.key }]))
                invalid('metrics', message)
    const previous = context.previous
    if (!previous) return
    if (['igdbId', 'slug', 'name'].some((key) => previous[key] !== data[key]))
        invalid('igdbId', 'IGDB identity cannot be edited. Import the game from search.')
    const { db, schema } = await database()
    const used = await db
        .select()
        .from(schema.gameStats)
        .where(eq(schema.gameStats.game, context.id))
    const keys = new Set(
        used.flatMap((entry) => (entry.values as GameValue[]).map((value) => value.key)),
    )
    for (const key of keys) {
        const before = (previous.metrics as GameMetric[]).find((metric) => metric.key === key)
        const after = metrics.find((metric) => metric.key === key)
        if (
            !after ||
            after.format !== before?.format ||
            (after.unit || '') !== (before?.unit || '')
        )
            invalid('metrics', `Keep the key, format and unit of recorded metric ${key}.`)
    }
}
export async function validateGameStatsRecord(data: Record<string, unknown>): Promise<void> {
    if (data.start && data.end && Date.parse(String(data.start)) > Date.parse(String(data.end)))
        invalid('end', 'End must follow start.')
    const { db, schema } = await database()
    const [game] = await db
        .select()
        .from(schema.games)
        .where(eq(schema.games.id, String(data.game)))
    if (!game) invalid('game', 'Choose a saved game.')
    for (const message of gameValueIssues(
        game!.metrics as GameMetric[],
        data.values as GameValue[],
    ))
        invalid('values', message)
}

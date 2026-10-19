import { db, sql } from 'void/db'
import { z } from 'zod'

import { gameTitleParts, postGameSlugs } from '../../shared/utils/gameMentions.js'
import { gameValueIssues, type GameMetric, type GameValue } from '../../shared/utils/games.js'
export async function savedGames() {
    return db.all<{ id: string; slug: string; name: string; metrics: string; igdbId: number }>(sql`
        SELECT e.id, g.field_slug AS slug, g.field_name AS name, g.field_metrics AS metrics, g.field_igdbId AS igdbId
        FROM site_admin_entries e JOIN site_admin_content_games g ON g.revision_id = e.current_revision_id WHERE e.model = 'games'
    `)
}
export const validatePostGames = z
    .looseObject({ title: z.string(), content: z.string(), tags: z.array(z.string()) })
    .transform(async (data) => {
        const slugs = await postGameSlugs(data.title, data.content)
        const games = slugs.length ? await savedGames() : []
        return {
            ...data,
            plainTitle: gameTitleParts(data.title)
                .map((part) => games.find((game) => game.slug === part.slug)?.name ?? part.text)
                .join(''),
            gameMentions: games.filter((game) => slugs.includes(game.slug)).map((game) => game.id),
        }
    })
export const validateGame = z
    .looseObject({
        igdbId: z.number().int().positive(),
        slug: z.string(),
        name: z.string(),
        primaryMetric: z.string().nullish(),
        metrics: z.array(z.any()).nullish(),
    })
    .superRefine(async (data, ctx) => {
        const metrics = (data.metrics ?? []) as GameMetric[]
        for (const metric of metrics)
            for (const position of metric.positions ?? [])
                for (const message of gameValueIssues([metric], [{ ...position, key: metric.key }]))
                    ctx.addIssue({ code: 'custom', path: ['metrics'], message })
        if (new Set(metrics.map((item) => item.key)).size !== metrics.length)
            ctx.addIssue({
                code: 'custom',
                path: ['metrics'],
                message: 'Metric keys must be unique.',
            })
        if (data.primaryMetric && !metrics.some((item) => item.key === data.primaryMetric))
            ctx.addIssue({
                code: 'custom',
                path: ['primaryMetric'],
                message: 'Choose an existing metric.',
            })
        const existing = (await savedGames()).find(
            (game) => game.igdbId === data.igdbId || game.slug === data.slug,
        )
        if (
            existing &&
            (existing.igdbId !== data.igdbId ||
                existing.slug !== data.slug ||
                existing.name !== data.name)
        )
            ctx.addIssue({
                code: 'custom',
                message: 'IGDB identity cannot be edited. Import the game from search.',
            })
        if (existing) {
            const used = await db.all<{ values: string }>(
                sql`SELECT s.field_values AS 'values' FROM site_admin_content_gameStats s JOIN site_admin_entries e ON e.current_revision_id = s.revision_id WHERE s.field_game = ${existing.id}`,
            )
            const keys = new Set(
                used.flatMap((row) =>
                    (JSON.parse(row.values) as GameValue[]).map((value) => value.key),
                ),
            )
            const previous = JSON.parse(existing.metrics || '[]') as GameMetric[]
            for (const key of keys)
                if (
                    !metrics.some(
                        (metric) =>
                            metric.key === key &&
                            metric.format === previous.find((item) => item.key === key)?.format &&
                            (metric.unit || '') ===
                                (previous.find((item) => item.key === key)?.unit || ''),
                    )
                )
                    ctx.addIssue({
                        code: 'custom',
                        path: ['metrics'],
                        message: `Keep the key, format and unit of recorded metric ${key}. Add a new metric for a new meaning.`,
                    })
        }
    })
export const validateGameStats = z
    .looseObject({
        game: z.string(),
        periodKey: z.string().min(1),
        period: z.string().min(1),
        order: z.number().int(),
        start: z.string().nullish(),
        end: z.string().nullish(),
        values: z.array(z.any()),
    })
    .superRefine(async (data, ctx) => {
        const game = (await savedGames()).find((item) => item.id === data.game)
        if (!game) {
            ctx.addIssue({ code: 'custom', path: ['game'], message: 'Choose a saved game.' })
            return
        }
        for (const message of gameValueIssues(JSON.parse(game.metrics || '[]'), data.values))
            ctx.addIssue({ code: 'custom', path: ['values'], message })
        if (data.start && data.end && Date.parse(data.start) > Date.parse(data.end))
            ctx.addIssue({ code: 'custom', path: ['end'], message: 'End must follow start.' })
    })

import type { ModelPreparationContext } from 'liti'
import { z } from 'zod'

import type { GameMetric, GameValue } from '../../shared/types/games'
import { gameValueIssues } from '../../shared/utils/games'

export const validateGame = z
    .looseObject({
        igdbId: z.number().int().positive(),
        slug: z.string(),
        name: z.string(),
        primaryMetric: z.string().nullish(),
        metrics: z.array(z.any()).nullish(),
    })
    .superRefine((data, ctx) => {
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
    })

export async function prepareGame(context: ModelPreparationContext) {
    const data = context.data as z.infer<typeof validateGame>
    const existing = context.previous
    if (!existing) return
    if (
        existing.data.igdbId !== data.igdbId ||
        existing.data.slug !== data.slug ||
        existing.data.name !== data.name
    )
        context.issues.push({
            path: 'igdbId',
            message: 'IGDB identity cannot be edited. Import the game from search.',
        })
    const used = (await context.read.current.listAllEntries('gameStats')).filter(
        (entry) => entry.data.game === existing.id,
    )
    const keys = new Set(
        used.flatMap((entry) => (entry.data.values as GameValue[]).map((value) => value.key)),
    )
    const previous = (existing.data.metrics ?? []) as GameMetric[]
    const metrics = (data.metrics ?? []) as GameMetric[]
    for (const key of keys)
        if (
            !metrics.some(
                (metric) =>
                    metric.key === key &&
                    metric.format === previous.find((item) => item.key === key)?.format &&
                    (metric.unit || '') === (previous.find((item) => item.key === key)?.unit || ''),
            )
        )
            context.issues.push({
                path: 'metrics',
                message: `Keep the key, format and unit of recorded metric ${key}. Add a new metric for a new meaning.`,
            })
}

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
    .superRefine((data, ctx) => {
        if (data.start && data.end && Date.parse(data.start) > Date.parse(data.end))
            ctx.addIssue({ code: 'custom', path: ['end'], message: 'End must follow start.' })
    })

export async function prepareGameStats(context: ModelPreparationContext) {
    const data = context.data as z.infer<typeof validateGameStats>
    const game = (await context.read.current.listAllEntries('games')).find(
        (item) => item.id === data.game,
    )
    if (!game) {
        context.issues.push({ path: 'game', message: 'Choose a saved game.' })
        return
    }
    for (const message of gameValueIssues((game.data.metrics ?? []) as GameMetric[], data.values))
        context.issues.push({ path: 'values', message })
}

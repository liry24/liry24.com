import { slugFromTitle } from '@litijs/blog'
import { defineRecordModel, field } from '@litijs/model'
import { image } from '@vite-hub/blob/reference'
import { optional } from '@vite-hub/content/collections'
import { z } from 'zod'

import { gameSlugPattern, gameColorPattern } from '../../shared/utils/games.js'
import { socialSlug } from '../../shared/utils/socials.js'
import { imageSchema } from '../utils/imageSchema.js'
import { modelActivity } from '../utils/modelActivity.js'
import {
    modelAuthorization,
    validateGameRecord,
    validateGameStatsRecord,
} from '../utils/modelValidation.js'

const text = () => field(z.string().optional())
const order = () => field(z.number().finite().default(0))
const picture = () => field(optional(image()), { input: 'image' })
const decoration = {
    label: z.string().optional(),
    image: imageSchema.optional(),
    color: z.string().regex(gameColorPattern).optional(),
}
export const games = defineRecordModel({
    name: 'games',
    label: 'Games',
    title: 'name',
    authorize: modelAuthorization,
    committed: modelActivity,
    unique: [['igdbId'], ['slug']],
    validate: validateGameRecord,
    fields: {
        igdbId: field(z.number().int().positive()),
        slug: field(z.string().regex(gameSlugPattern)),
        name: field(z.string().min(1)),
        cover: field(z.httpUrl().optional()),
        icon: picture(),
        primaryMetric: text(),
        order: order(),
        metrics: field(
            z
                .array(
                    z.object({
                        key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
                        label: z.string().min(1),
                        format: z.enum(['integer', 'decimal', 'percent']),
                        unit: z.string().optional(),
                        positions: z
                            .array(
                                z.object({
                                    ...decoration,
                                    label: z.string().min(1),
                                    value: z.number().nonnegative(),
                                }),
                            )
                            .max(100)
                            .default([]),
                    }),
                )
                .max(30)
                .default([]),
            { input: 'json' },
        ),
    },
})
export const gameStats = defineRecordModel({
    name: 'gameStats',
    label: 'Game Stats',
    title: 'period',
    authorize: modelAuthorization,
    committed: modelActivity,
    unique: [['game', 'periodKey']],
    validate: validateGameStatsRecord,
    fields: {
        game: field(z.string().min(1), { reference: 'games', input: 'relation' }),
        periodKey: field(z.string().min(1)),
        period: field(z.string().min(1)),
        order: field(z.number().int().default(0)),
        start: field(z.iso.datetime({ offset: true }).optional(), { input: 'date' }),
        end: field(z.iso.datetime({ offset: true }).optional(), { input: 'date' }),
        values: field(
            z
                .array(
                    z.object({
                        ...decoration,
                        key: z.string().min(1),
                        value: z.number().nonnegative(),
                    }),
                )
                .max(30)
                .default([]),
            { input: 'json' },
        ),
        href: field(z.httpUrl().optional()),
    },
})
export const ranks = defineRecordModel({
    name: 'ranks',
    label: 'Legacy Ranks',
    title: 'game',
    authorize: modelAuthorization,
    committed: modelActivity,
    fields: {
        game: field(z.string().min(1)),
        image: field(image(), { input: 'image' }),
        slug: text(),
        season: text(),
        rank: field(z.string().min(1)),
        href: field(z.httpUrl().optional()),
        order: order(),
    },
})
export const socials = defineRecordModel({
    name: 'socials',
    label: 'Socials',
    title: 'label',
    authorize: modelAuthorization,
    committed: modelActivity,
    unique: [['slug']],
    prepare: (input, context) => ({
        ...input,
        data: {
            ...input.data,
            slug:
                input.data.slug ||
                context.previous?.slug ||
                `${slugFromTitle(String(input.data.label ?? '')) || 'social'}-${context.id}`,
        },
    }),
    fields: {
        label: field(z.string().min(1)),
        slug: field(z.string().refine(socialSlug, 'Choose an unreserved URL segment.')),
        href: field(z.httpUrl()),
        icon: field(z.string()),
        order: order(),
    },
})

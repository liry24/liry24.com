import { z } from 'zod'

import { gameColorPattern, gameSlugPattern } from '../utils/games.js'
import { socialSlug } from '../utils/socials.js'

export interface MediaReference {
    pathname: string
    contentType?: string
    size?: number
}

export const mediaReferenceSchema: z.ZodType<MediaReference> = z.object({
    pathname: z.string().min(1),
    contentType: z.string().optional(),
    size: z.number().finite().nonnegative().optional(),
})

export const postFieldsSchema = z.object({
    title: z.string().min(1),
    plainTitle: z.string().default(''),
    slug: z.string().min(1),
    summary: z.string().optional(),
    cover: mediaReferenceSchema.optional(),
    tags: z.array(z.string()).default([]),
    authoredAt: z.iso.datetime({ offset: true }).optional(),
    gameMentions: z.array(z.string()).default([]),
    authorUserId: z.string().optional(),
    order: z.number().finite().default(0),
})

export const workFieldsSchema = z.object({
    title: z.string().min(1),
    slug: z.string().min(1),
    image: mediaReferenceSchema.optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),
    href: z.httpUrl().optional(),
    price: z.string().optional(),
    style: z.enum(['large', 'small']).default('small'),
    authoredAt: z.iso.datetime({ offset: true }).optional(),
    order: z.number().finite().default(0),
})

export const artFieldsSchema = z.object({
    title: z.string().min(1),
    slug: z.string().min(1),
    images: z.array(mediaReferenceSchema).min(1),
    description: z.string().optional(),
    href: z.httpUrl().optional(),
    authoredAt: z.iso.datetime({ offset: true }).optional(),
    order: z.number().finite().default(0),
})

export const careerFieldsSchema = z.object({
    company: z.string().min(1),
    slug: z.string().min(1),
    period: z.string().min(1),
    position: z.string().min(1),
    order: z.number().finite().default(0),
})

export const skillFieldsSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    icon: z.string().min(1),
    category: z.string().optional(),
    order: z.number().finite().default(0),
})

const gameDecorationSchema = {
    label: z.string().optional(),
    image: mediaReferenceSchema.optional(),
    color: z.string().regex(gameColorPattern).optional(),
}

export const gameMetricSchema = z.object({
    key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
    label: z.string().min(1),
    format: z.enum(['integer', 'decimal', 'percent']),
    unit: z.string().optional(),
    positions: z
        .array(
            z.object({
                ...gameDecorationSchema,
                label: z.string().min(1),
                value: z.number().nonnegative(),
            }),
        )
        .max(100)
        .default([]),
})

export const gameFieldsSchema = z.object({
    igdbId: z.number().int().positive(),
    slug: z.string().regex(gameSlugPattern),
    name: z.string().min(1),
    cover: z.httpUrl().optional(),
    icon: mediaReferenceSchema.optional(),
    primaryMetric: z.string().optional(),
    order: z.number().finite().default(0),
    metrics: z.array(gameMetricSchema).max(30).default([]),
})

export const gameStatValueSchema = z.object({
    ...gameDecorationSchema,
    key: z.string().min(1),
    value: z.number().nonnegative(),
})

export const gameStatsFieldsSchema = z.object({
    game: z.string().min(1),
    periodKey: z.string().min(1),
    period: z.string().min(1),
    order: z.number().int().default(0),
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).optional(),
    values: z.array(gameStatValueSchema).max(30).default([]),
    href: z.httpUrl().optional(),
})

export const socialFieldsSchema = z.object({
    label: z.string().min(1),
    slug: z.string().refine(socialSlug, 'Choose an unreserved URL segment.'),
    href: z.httpUrl(),
    icon: z.string(),
    order: z.number().finite().default(0),
})

export const contentCollectionNames = [
    'posts',
    'works',
    'arts',
    'careers',
    'skills',
    'gameStats',
    'socials',
] as const

export type ContentCollectionName = (typeof contentCollectionNames)[number]

export type PortfolioCollectionName = Exclude<ContentCollectionName, 'posts'>

export type PostData = z.infer<typeof postFieldsSchema>
export type WorkData = z.infer<typeof workFieldsSchema>
export type ArtData = z.infer<typeof artFieldsSchema>
export type CareerData = z.infer<typeof careerFieldsSchema>
export type SkillData = z.infer<typeof skillFieldsSchema>
export type GameRecordData = z.infer<typeof gameFieldsSchema>
export type GameStatsRecordData = z.infer<typeof gameStatsFieldsSchema>
export type SocialData = z.infer<typeof socialFieldsSchema>

export type PortfolioDataMap = {
    works: WorkData
    arts: ArtData
    careers: CareerData
    skills: SkillData
    gameStats: GameStatsRecordData
    socials: SocialData
}

export interface PortfolioItem<TName extends PortfolioCollectionName = PortfolioCollectionName> {
    id: string
    data: PortfolioDataMap[TName]
}

export interface PostItem {
    id: string
    url: string | null
    data: PostData
    body: string
    publishedAt?: string
    updatedAt?: string
}

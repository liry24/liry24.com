export type AdminEntryData = Partial<
    WorkData & ArtData & CareerData & SkillData & GameStatsRecordData & SocialData
>

export interface AdminEntryRecord<T = AdminEntryData> {
    id: string
    data: T
}

export const adminEntryForms = {
    works: {
        label: 'work',
        endpoint: 'work',
        schema: workFieldsSchema.omit({ order: true }).partial({ slug: true }),
    },
    arts: {
        label: 'artwork',
        endpoint: 'art',
        schema: artFieldsSchema.omit({ order: true }).partial({ slug: true }),
    },
    careers: {
        label: 'career entry',
        endpoint: 'career',
        schema: careerFieldsSchema.omit({ order: true }).partial({ slug: true }),
    },
    skills: {
        label: 'skill',
        endpoint: 'skill',
        schema: skillFieldsSchema.omit({ order: true }).partial({ slug: true }),
    },
    gameStats: {
        label: 'stat period',
        endpoint: 'game-stats',
        schema: gameStatsFieldsSchema.omit({ order: true }).partial({ periodKey: true }),
    },
    socials: {
        label: 'social link',
        endpoint: 'social',
        schema: socialFieldsSchema.omit({ order: true }).partial({ slug: true }),
    },
} satisfies Record<PortfolioCollectionName, { label: string; endpoint: string; schema: z.ZodType }>
import type { z } from 'zod'

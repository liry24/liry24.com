import type { Node } from 'comark'
import type { z } from 'zod'

import type {
    artFieldsSchema,
    careerFieldsSchema,
    contentCollectionNames,
    gameFieldsSchema,
    gameStatsFieldsSchema,
    postFieldsSchema,
    skillFieldsSchema,
    socialFieldsSchema,
    workFieldsSchema,
} from '../utils/contentSchemas.js'

export interface MediaReference {
    pathname: string
    contentType?: string
    size?: number
}

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

type PortfolioDataMap = {
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

export type PostCard = Omit<PostData, 'summary'> & {
    id: string
    url: string | null
    date: string | null
    excerpt: {
        nodes: Array<Node>
        frontmatter: Record<string, never>
        meta: Record<string, never>
    }
}

export interface PostCardsPage {
    items: Array<PostCard>
    total: number
}

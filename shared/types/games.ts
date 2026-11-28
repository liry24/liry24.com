import type { GameRecordData, MediaReference, PortfolioItem } from '../types/content.js'

type GamePosition = {
    value: number
    label: string
    image?: MediaReference | null
    color?: string | null
}

export type GameMetric = {
    key: string
    label: string
    format: 'integer' | 'decimal' | 'percent'
    unit?: string | null
    positions?: Array<GamePosition> | null
}

export type GameValue = {
    key: string
    value: number
    label?: string | null
    image?: MediaReference | null
    color?: string | null
}

type GameData = {
    slug: string
    igdbId: number
    name: string
    cover?: string | null
    icon?: MediaReference | null
    primaryMetric?: string | null
    metrics?: Array<GameMetric> | null
}

export type GameSearchResult = Pick<GameData, 'igdbId' | 'slug' | 'name' | 'cover' | 'icon'> & {
    id?: string
}

export type GameSearchSource = 'igdb' | 'emulator'

export interface GameSearchResponse {
    games: Array<GameSearchResult>
    warning: string
    source?: GameSearchSource
}

export interface GameCatalogItem {
    id: string
    data: GameRecordData
}

export interface GameCatalogMeta {
    postCount: number
    publishedMetricKeys: Array<string>
    draftMetricStatIds: Record<string, Array<string>>
}

export interface GameCatalogResponse {
    items: Array<GameCatalogItem>
    meta?: Record<string, GameCatalogMeta>
}

export type GameMentionData = Pick<GameData, 'name' | 'slug' | 'icon' | 'cover'>

export type GameStatsDisplay = Pick<
    GameData,
    'name' | 'slug' | 'cover' | 'icon' | 'primaryMetric' | 'metrics'
>

export interface GameStatsPage {
    items: Array<PortfolioItem<'gameStats'>>
    total: number
    games: Array<{ id: string; data: GameStatsDisplay }>
}

export type GamePeriod = {
    period: string
    periodKey: string
    order: number
    values: Array<GameValue>
    href?: string | null
}

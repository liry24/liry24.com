import type { MediaReference, PortfolioItem } from '../schemas/content.js'

export type GamePosition = {
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

export type GameData = {
    slug: string
    igdbId: number
    name: string
    cover?: string | null
    icon?: MediaReference | null
    primaryMetric?: string | null
    metrics?: Array<GameMetric> | null
}

export type GameSearchResult = Pick<GameData, 'igdbId' | 'slug' | 'name' | 'cover'> & {
    id?: string
}

export type GameMentionData = Pick<GameData, 'name' | 'slug' | 'icon' | 'cover'>

export type GameStatsDisplay = Pick<GameData, 'name' | 'slug' | 'primaryMetric' | 'metrics'>

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

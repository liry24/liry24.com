import type { BlobReference } from '@vite-hub/blob/reference'

export type GamePosition = {
    value: number
    label: string
    image?: BlobReference | null
    color?: string | null
}

export type GameMetric = {
    key: string
    label: string
    format: 'integer' | 'decimal' | 'percent'
    unit?: string | null
    positions?: GamePosition[] | null
}

export type GameValue = {
    key: string
    value: number
    label?: string | null
    image?: BlobReference | null
    color?: string | null
}

export type GameData = {
    slug: string
    igdbId: number
    name: string
    cover?: string | null
    icon?: BlobReference | null
    primaryMetric?: string | null
    metrics?: GameMetric[] | null
}

export type GameSearchResult = Pick<GameData, 'igdbId' | 'slug' | 'name' | 'cover'> & {
    id?: string
}

export type GamePeriod = {
    period: string
    periodKey: string
    order: number
    values: GameValue[]
    href?: string | null
}

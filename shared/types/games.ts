import type { AssetInput } from 'liti'

export type GamePosition = {
    value: number
    label: string
    image?: AssetInput | null
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
    image?: AssetInput | null
    color?: string | null
}

export type GameData = {
    slug: string
    igdbId: number
    name: string
    cover?: string | null
    icon?: AssetInput | null
    primaryMetric?: string | null
    metrics?: GameMetric[] | null
}

export type GamePeriod = {
    period: string
    periodKey: string
    order: number
    values: GameValue[]
    href?: string | null
}

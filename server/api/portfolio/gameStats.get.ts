import { defineEventHandler } from 'nuxt/server'

import content from '../../content.js'
import { listAllCollectionItems } from '../../utils/content.js'
import { gameCatalog } from '../../utils/gameCatalog.js'

export default defineEventHandler(async (): Promise<GameStatsPage> => {
    const items = await listAllCollectionItems(content.collection('gameStats'), 'published')
    items.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))

    const referencedIds = new Set(items.map((item) => item.data.game))
    const games = referencedIds.size ? await gameCatalog().list() : []
    const gameDisplays = games
        .filter((game) => referencedIds.has(game.id))
        .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
        .map(({ id, data: { slug, name, primaryMetric, metrics } }) => ({
            id,
            data: { slug, name, primaryMetric, metrics },
        }))
    return { items, total: items.length, games: gameDisplays }
})

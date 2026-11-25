import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'

import type { PortfolioCollectionName, PortfolioItem } from '../../../shared/schemas/content.js'
import content from '../../content.js'
import { listAllCollectionItems } from '../../utils/content.js'

const portfolioModels = [
    'works',
    'arts',
    'careers',
    'skills',
    'socials',
] as const satisfies ReadonlyArray<PortfolioCollectionName>

function parsePortfolioModel(raw: string | undefined) {
    return portfolioModels.find((entry) => entry === raw)
}

async function listModelItems(
    name: (typeof portfolioModels)[number],
): Promise<Array<PortfolioItem>> {
    switch (name) {
        case 'works': {
            return await listAllCollectionItems(content.collection('works'), 'published')
        }
        case 'arts': {
            return await listAllCollectionItems(content.collection('arts'), 'published')
        }
        case 'careers': {
            return await listAllCollectionItems(content.collection('careers'), 'published')
        }
        case 'skills': {
            return await listAllCollectionItems(content.collection('skills'), 'published')
        }
        case 'socials': {
            return await listAllCollectionItems(content.collection('socials'), 'published')
        }
    }
}

export default defineEventHandler(async (event) => {
    const name = parsePortfolioModel(getRouterParam(event, 'model'))
    if (!name) {
        throw createError({ status: 404, statusText: 'Collection not found' })
    }

    const items = await listModelItems(name)
    items.sort((a, b) => {
        const orderA = 'order' in a.data ? Number(a.data.order ?? 0) : 0
        const orderB = 'order' in b.data ? Number(b.data.order ?? 0) : 0
        return orderA - orderB || a.id.localeCompare(b.id)
    })
    return { items, total: items.length }
})

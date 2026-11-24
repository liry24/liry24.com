import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'

import type { PostItem } from '../../../shared/schemas/content.js'
import content from '../../content.js'
import { listAllCollectionItems } from '../../utils/content.js'

export default defineEventHandler(async (event) => {
    const rawSlug = getRouterParam(event, 'slug')
    if (!rawSlug) {
        throw createError({ status: 404, statusText: 'Post not found' })
    }
    let slug: string
    try {
        slug = decodeURIComponent(rawSlug)
    } catch {
        throw createError({ status: 404, statusText: 'Post not found' })
    }

    const collection = content.collection('posts')
    const items = await listAllCollectionItems(collection, 'published')
    const matched = items.find((doc) => doc.data.slug === slug || doc.id === slug)
    if (!matched) {
        throw createError({ status: 404, statusText: 'Post not found' })
    }
    const full = await collection.get(matched.id, { ref: 'published' })
    if (!full) {
        throw createError({ status: 404, statusText: 'Post not found' })
    }
    const result: PostItem = {
        id: full.id,
        url: full.url ?? null,
        data: full.data,
        body: full.body,
        publishedAt: full.data.authoredAt,
        updatedAt: full.data.authoredAt,
    }
    return result
})

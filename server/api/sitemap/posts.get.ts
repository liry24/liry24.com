import { defineEventHandler } from 'nuxt/server'

import content from '../../content.js'
import { listAllCollectionItems } from '../../utils/content.js'

export default defineEventHandler(async () => {
    const posts = await listAllCollectionItems(content.collection('posts'), 'published')
    const urls: Array<{ loc: string; lastmod?: string }> = []
    for (const doc of posts) {
        if (!doc.url) {
            continue
        }
        if (doc.data.authoredAt) {
            urls.push({ loc: doc.url, lastmod: doc.data.authoredAt })
        } else {
            urls.push({ loc: doc.url })
        }
    }
    return urls
})

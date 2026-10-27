import { defineEventHandler } from 'nuxt/server'

import runtime from '#liti/runtime'

export default defineEventHandler(async () => {
    const urls: { loc: string; lastmod?: string }[] = []
    for (let offset = 0; ; offset += 1000) {
        const page = await runtime.content.query('posts', { locale: 'ja', limit: 1000, offset })
        for (const entry of page.items)
            if (entry.url)
                urls.push({
                    loc: entry.url,
                    ...(entry.publication?.updatedAt
                        ? { lastmod: entry.publication.updatedAt }
                        : {}),
                })
        if (offset + page.items.length >= page.total) return urls
    }
})

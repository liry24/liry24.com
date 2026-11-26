import content from '#server/content'

export default defineEventHandler(async () => {
    const posts = await listAllCollectionItems(content.collection('posts'), 'published')
    const urls: Array<{ loc: string; lastmod?: string }> = []
    for (const doc of posts) {
        if (!doc.url) continue

        urls.push({ loc: doc.url, lastmod: doc.data.authoredAt ?? doc.updatedAt ?? undefined })
    }
    return urls
})

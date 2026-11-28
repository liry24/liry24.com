export default defineEventHandler(async () => {
    const { items: posts } = await getPublishedPostsSnapshot()
    const urls: Array<{ loc: string; lastmod?: string }> = []
    for (const doc of posts) {
        if (!doc.url) continue

        urls.push({ loc: doc.url, lastmod: doc.data.authoredAt ?? doc.updatedAt ?? undefined })
    }
    return urls
})

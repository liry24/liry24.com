import content from '#server/content'

export default defineEventHandler(async (event) => {
    const slug = readDecodedRouterParam(event, 'slug', 'Post not found')

    const collection = content.collection('posts')
    const items = await listAllCollectionItems(collection, 'published')
    const matched = items.find((doc) => doc.data.slug === slug || doc.id === slug)
    if (!matched) throw createError({ status: 404, statusText: 'Post not found' })

    const full = await collection.get(matched.id, { ref: 'published' })
    if (!full) throw createError({ status: 404, statusText: 'Post not found' })

    const { generateSlugOnPublish: _generateSlugOnPublish, ...data } = full.data
    const { meta } = await parsePostDescription(full.body)
    return {
        id: full.id,
        url: full.url ?? null,
        data,
        body: full.body,
        description: meta.description?.trim() || undefined,
        publishedAt: full.updatedAt ?? undefined,
        updatedAt: full.updatedAt ?? undefined,
    }
})

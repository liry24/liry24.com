import { eq } from 'drizzle-orm'

import content from '#server/content'

export default defineEventHandler(async (event): Promise<PostDetailResponse | Response> => {
    const slug = readDecodedRouterParam(event, 'slug', 'Post not found')
    let revision = await getPublishedRevision()
    if (!revision) throw createError({ status: 404, statusText: 'Post not found' })

    const collection = content.collection('posts')
    const { db, schema } = useDatabase('default')
    const table = schema.postSlugs
    const claim = await db
        .select({ postId: table.postId })
        .from(table)
        .where(eq(table.slug, slug.toLowerCase()))
        .get()
    let full = claim ? await collection.get(claim.postId, { revision }) : null
    if (!full || (full.data.slug !== slug && full.id !== slug)) {
        const snapshot = await getPublishedPostsSnapshot()
        const matched = snapshot.bySlug.get(slug) ?? snapshot.byId.get(slug)
        if (!matched || !snapshot.revision)
            throw createError({ status: 404, statusText: 'Post not found' })

        revision = snapshot.revision
        full = await collection.get(matched.id, { revision })
    }

    if (!full) throw createError({ status: 404, statusText: 'Post not found' })

    if (applyPublicCacheHeaders(event, `post-${revision}-${full.digest}`))
        return new Response(null, { status: 304 })

    const { generateSlugOnPublish: _generateSlugOnPublish, ...data } = full.data
    const [{ document, description }, games] = await Promise.all([
        getParsedPostContent(full.digest, full.body),
        gameCatalog().byIds(data.gameMentions),
    ])
    return {
        id: full.id,
        url: full.url ?? null,
        data,
        body: full.body,
        document,
        games: gameMentionDataBySlug(games),
        description,
        publishedAt: full.updatedAt ?? undefined,
        updatedAt: full.updatedAt ?? undefined,
    }
})

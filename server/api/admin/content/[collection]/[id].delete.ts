import content from '#server/content'

export default defineEventHandler(async (event) => {
    const session = await requireAdminSession(event)
    const collectionName = parseCollectionName(getRouterParam(event, 'collection'))
    const id = readDecodedRouterParam(event, 'id', 'Document not found')

    const publishDeletion = getQuery(event).publish === 'true'
    const col = content.collection(collectionName)
    if (collectionName === 'posts' && publishDeletion) {
        const published = await content.collection('posts').get(id, { ref: 'published' })
        if (published && !(await claimPostSlugs(id, published.data.slug))) throw postSlugConflict()
    }
    await col.remove(id)
    if (publishDeletion) {
        await content.publish({
            expect: [{ collection: collectionName, id, digest: null }],
            metadata: { actorUserId: session.user.id },
        })
    }
    return { ok: true, id }
})

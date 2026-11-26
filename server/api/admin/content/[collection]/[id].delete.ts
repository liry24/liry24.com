import content from '#server/content'

const validCollections = new Set<string>(contentCollectionNames)

function parseCollectionName(raw: string | undefined): ContentCollectionName {
    if (!raw || !validCollections.has(raw)) {
        throw createError({ status: 404, statusText: 'Collection not found' })
    }
    const matched = contentCollectionNames.find((name) => name === raw)
    if (!matched) {
        throw createError({ status: 404, statusText: 'Collection not found' })
    }
    return matched
}

export default defineEventHandler(async (event) => {
    const session = await requireAdminSession(event)
    const collectionName = parseCollectionName(getRouterParam(event, 'collection'))
    const rawId = getRouterParam(event, 'id')
    if (!rawId) {
        throw createError({ status: 404, statusText: 'Document not found' })
    }
    const id = decodeURIComponent(rawId)
    const publishDeletion = getQuery(event).publish === 'true'
    const col = content.collection(collectionName)
    await col.remove(id)
    if (publishDeletion) {
        await content.publish({
            expect: [{ collection: collectionName, id, digest: null }],
            metadata: { actorUserId: session.user.id },
        })
    }
    return { ok: true, id }
})

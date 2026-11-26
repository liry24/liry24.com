const validCollections = new Set<string>(contentCollectionNames)

function parseCollectionName(raw: string | undefined): ContentCollectionName {
    if (!raw || !validCollections.has(raw))
        throw createError({ status: 404, statusText: 'Collection not found' })

    const matched = contentCollectionNames.find((name) => name === raw)
    if (!matched) throw createError({ status: 404, statusText: 'Collection not found' })

    return matched
}

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const collectionName = parseCollectionName(getRouterParam(event, 'collection'))
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ status: 404, statusText: 'Document not found' })

    event.res.headers.set('Cache-Control', 'private, no-store')
    const doc = await getAdminDocument(collectionName, decodeURIComponent(id))
    if (!doc) throw createError({ status: 404, statusText: 'Document not found' })

    return doc
})

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const collectionName = parseCollectionName(getRouterParam(event, 'collection'))
    const id = readDecodedRouterParam(event, 'id', 'Document not found')

    event.res.headers.set('Cache-Control', 'private, no-store')
    const doc = await getAdminDocument(collectionName, id)
    if (!doc) throw createError({ status: 404, statusText: 'Document not found' })

    return doc
})

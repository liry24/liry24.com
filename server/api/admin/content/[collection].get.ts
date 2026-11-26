export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const collectionName = parseCollectionName(getRouterParam(event, 'collection'))
    event.res.headers.set('Cache-Control', 'private, no-store')
    return await listAdminCollection(collectionName)
})

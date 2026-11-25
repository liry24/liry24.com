export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    event.res.headers.set('Cache-Control', 'private, no-store')
    return { items: await gameCatalog().listOrdered() }
})

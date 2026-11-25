export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ status: 404, statusText: 'Game not found' })
    }
    await validateGameRemoval(id)
    await gameCatalog().remove(id)
    return { ok: true, id }
})

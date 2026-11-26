export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const id = readDecodedRouterParam(event, 'id', 'Game not found')

    await validateGameRemoval(id)
    await gameCatalog().remove(id)
    return { ok: true, id }
})

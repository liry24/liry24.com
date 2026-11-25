import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'

import { requireAdminSession } from '../../../utils/auth.js'
import { gameCatalog } from '../../../utils/gameCatalog.js'
import { validateGameRemoval } from '../../../utils/gameValidation.js'

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

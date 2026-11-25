import { defineEventHandler } from 'nuxt/server'

import { requireAdminSession } from '../../../utils/auth.js'
import { gameCatalog } from '../../../utils/gameCatalog.js'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    event.res.headers.set('Cache-Control', 'private, no-store')
    return { items: await gameCatalog().listOrdered() }
})

import { defineEventHandler } from 'nuxt/server'
import { db, eq } from 'void/db'

import { accounts } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
    await requireAdminPermission(event, { user: ['get'] })
    const user = await findAdminUser(event)
    const providers = await db
        .select({ providerId: accounts.providerId })
        .from(accounts)
        .where(eq(accounts.userId, user.id))
    return { user, providers: [...new Set(providers.map(({ providerId }) => providerId))] }
})

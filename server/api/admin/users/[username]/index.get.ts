import { eq } from 'drizzle-orm'
import { defineEventHandler } from 'nuxt/server'
import { db } from 'vite-hub/database/drizzle'

import { account as accounts } from '../../../../database/auth-schema'

export default defineEventHandler(async (event) => {
    await requireAdminPermission(event, { user: ['get'] })
    const user = await findAdminUser(event)
    const providers = await db
        .select({ providerId: accounts.providerId })
        .from(accounts)
        .where(eq(accounts.userId, user.id))
    return { user, providers: [...new Set(providers.map(({ providerId }) => providerId))] }
})

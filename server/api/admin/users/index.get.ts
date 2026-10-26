import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import { db, count, desc } from 'void/db'
import { z } from 'zod'

import { users } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
    await requireAdminPermission(event, { user: ['list'] })
    const result = z
        .object({
            limit: z.coerce.number().int().min(1).max(100).default(20),
            offset: z.coerce.number().int().nonnegative().max(1_000_000).default(0),
        })
        .safeParse(getQuery(event))
    if (!result.success) throw createError({ status: 400, statusText: 'Invalid pagination' })
    const { limit, offset } = result.data
    const [items, totals] = await Promise.all([
        db
            .select(adminUserFields)
            .from(users)
            .orderBy(desc(users.createdAt), desc(users.id))
            .limit(limit)
            .offset(offset),
        db.select({ total: count() }).from(users),
    ])
    return { items, total: totals[0]?.total ?? 0, limit, offset }
})

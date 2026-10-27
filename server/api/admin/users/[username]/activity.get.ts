import { and, or, eq, lt, desc } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import { db } from 'vite-hub/database/drizzle'
import { z } from 'zod'

import { adminEvent as adminEvents } from '../../../../database/auth-schema'

export default defineEventHandler(async (event) => {
    event.res.headers.set('Cache-Control', 'private, no-store')
    const viewer = await requireAppSession(event.req)
    const user = await findAdminUser(event)
    await requireAdminPermission(event, {
        activity: [viewer.user.id === user.id ? 'readOwn' : 'readAny'],
    })
    const parsed = z
        .object({
            limit: z.coerce.number().int().min(1).max(100).default(20),
            cursor: z.string().max(512).optional(),
        })
        .safeParse(getQuery(event))
    if (!parsed.success) throw createError({ status: 400, statusText: 'Invalid pagination' })
    const { limit, cursor } = parsed.data
    let boundary: { at: number; id: string } | undefined
    if (cursor) {
        try {
            boundary = z
                .object({
                    at: z.number().int().min(0).max(8_640_000_000_000_000),
                    id: z.string().min(1).max(128),
                })
                .parse(JSON.parse(atob(cursor)))
        } catch {
            throw createError({ status: 400, statusText: 'Invalid activity cursor' })
        }
    }
    const rows = await db
        .select()
        .from(adminEvents)
        .where(
            and(
                eq(adminEvents.actorId, user.id),
                boundary
                    ? or(
                          lt(adminEvents.createdAt, new Date(boundary.at)),
                          and(
                              eq(adminEvents.createdAt, new Date(boundary.at)),
                              lt(adminEvents.id, boundary.id),
                          ),
                      )
                    : undefined,
            ),
        )
        .orderBy(desc(adminEvents.createdAt), desc(adminEvents.id))
        .limit(limit + 1)
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
        items,
        nextCursor:
            rows.length > limit && last
                ? btoa(JSON.stringify({ at: last.createdAt.getTime(), id: last.id }))
                : null,
    }
})

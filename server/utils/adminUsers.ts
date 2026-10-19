import { createError, getRouterParam, type RequestEvent } from 'nuxt/server'
import { db, eq, and, or, isNull } from 'void/db'

import { users } from '../../db/schema'

export const adminUserFields = {
    id: users.id,
    name: users.name,
    username: users.username,
    displayUsername: users.displayUsername,
    email: users.email,
    emailVerified: users.emailVerified,
    image: users.image,
    role: users.role,
    banned: users.banned,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
}

export async function findAdminUser(event: RequestEvent) {
    const username = getRouterParam(event, 'username')
    if (!username || username.length > 128)
        throw createError({ statusCode: 400, statusMessage: 'Invalid username' })
    const [user] = await db
        .select(adminUserFields)
        .from(users)
        .where(
            username.startsWith('~')
                ? and(
                      eq(users.id, username.slice(1)),
                      or(isNull(users.username), eq(users.username, '')),
                  )
                : eq(users.username, username.toLowerCase()),
        )
        .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
    return user
}

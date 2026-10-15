import type {} from '@liria24/site-admin/nuxt'
import * as schema from '@schema'
import { createError, useServerHooks } from 'nuxt/server'
import { db, and, eq, sql } from 'void/db'

export default defineNitroPlugin(() => {
    useServerHooks().hook('site-admin:authorize', async ({ actor }) => {
        if (import.meta.dev || process.env.APP_ENV !== 'dev') return
        const [account] = await db.all<{ accountId: string }>(sql`
            SELECT ${schema.accounts.accountId} AS "accountId"
            FROM ${schema.accounts}
            WHERE ${and(eq(schema.accounts.userId, actor.id), eq(schema.accounts.providerId, 'github'))}
            LIMIT 1
        `)
        if (!account || !(await isPreviewGitHubAccountAdmin(account.accountId))) {
            throw createError({
                status: 403,
                statusText: 'Preview access requires repository admin permission',
            })
        }
    })
})

import type {} from '@liria24/site-admin/nuxt'
import { and, eq } from 'drizzle-orm'
import { createError, useServerHooks } from 'nuxt/server'

import * as schema from '../database/schema'

export default defineNitroPlugin(() => {
    useServerHooks().hook('site-admin:authorize', async ({ event, actor }) => {
        if (process.env.APP_ENV !== 'preview') return
        const [account] = await useDB(event)
            .select({ accountId: schema.accounts.accountId })
            .from(schema.accounts)
            .where(
                and(eq(schema.accounts.userId, actor.id), eq(schema.accounts.providerId, 'github')),
            )
            .limit(1)
        if (!account || !(await isPreviewGitHubAccountAdmin(account.accountId))) {
            throw createError({
                status: 403,
                statusText: 'Preview access requires repository admin permission',
            })
        }
    })
})

import type {} from '@liria24/site-admin/nuxt'
import { schema } from '@repo/database'
import { and, eq } from 'drizzle-orm'

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('site-admin:authorize', async ({ event, actor }) => {
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
                statusCode: 403,
                statusMessage: 'Preview access requires repository admin permission',
            })
        }
    })
})

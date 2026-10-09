import { useSiteAdmin } from '@liria24/site-admin/nuxt/server'
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:scheduled', ({ controller, context, env }) => {
        context.waitUntil(
            useSiteAdmin(undefined, { env }).then((admin) =>
                admin.publishDue(new Date(controller.scheduledTime)),
            ),
        )
    })
})

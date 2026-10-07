import { useSiteAdmin } from '@liria24/site-admin/nuxt/server'
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:scheduled', ({ controller, context }) => {
        context.waitUntil(
            useSiteAdmin().then((admin) => admin.publishDue(new Date(controller.scheduledTime))),
        )
    })
})

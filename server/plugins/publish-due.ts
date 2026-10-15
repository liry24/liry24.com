import { useAdmin } from '@liria24/site-admin/server'
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:scheduled', ({ controller, context, env }) => {
        context.waitUntil(
            useAdmin(undefined, { env }).tasks.publishDue(new Date(controller.scheduledTime)),
        )
    })
})

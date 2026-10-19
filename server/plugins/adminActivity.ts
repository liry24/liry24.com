import { useServerHooks } from 'nuxt/server'

import config from '../../site-admin.config'

export default defineNitroPlugin(() => {
    useServerHooks().hook('site-admin:entry:committed', async (event) => {
        if (!event.actorId) return
        const title = config.models[event.model as keyof typeof config.models]?.displayFields?.title
        const label = title ? event.data?.[title] : undefined
        await recordAdminActivity({
            actorId: event.actorId,
            action: `content.${event.type}`,
            targetId: event.entryId,
            model: event.model,
            label: typeof label === 'string' ? label : undefined,
        })
    })
})

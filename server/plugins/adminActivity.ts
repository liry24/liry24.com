import { resolveLitiConfig } from 'liti'
import { useServerHooks } from 'nuxt/server'

import config from '../../liti.config'

const models = resolveLitiConfig(config, []).models

export default defineNitroPlugin(() => {
    useServerHooks().hook('liti:entry:committed', async (event) => {
        if (!event.actorId) return
        const title = models[event.model as keyof typeof models]?.displayFields?.title
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

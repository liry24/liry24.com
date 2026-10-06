import { drizzleAdapter as authAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import type {} from '@liria24/site-admin/nuxt'
import type { H3Event } from 'h3'

import type { Database } from '../database'
import * as schema from '../database/schema'

const adapters = new WeakMap<
    Database,
    { auth: ReturnType<typeof authAdapter>; siteAdmin: ReturnType<typeof drizzleAdapter> }
>()

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('site-admin:database', (context) => {
        const db = useDB(context.event as H3Event | undefined)
        let pair = adapters.get(db)
        if (!pair) {
            pair = {
                auth: authAdapter(db, {
                    provider: 'sqlite',
                    schema,
                    transaction: false,
                    usePlural: true,
                }),
                siteAdmin: drizzleAdapter(db, { schema }),
            }
            adapters.set(db, pair)
        }
        context.authDatabase = pair.auth
        context.database = pair.siteAdmin
    })
})

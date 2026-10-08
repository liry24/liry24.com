import { drizzleAdapter as authAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import type {} from '@liria24/site-admin/nuxt'
import { useServerHooks } from 'nuxt/server'

import { getDevelopmentDB, setDevelopmentDB, type Database } from '../database'
import * as schema from '../database/schema'

const adapters = new WeakMap<
    Database,
    { auth: ReturnType<typeof authAdapter>; siteAdmin: ReturnType<typeof drizzleAdapter> }
>()

export default defineNitroPlugin(async (nitroApp) => {
    // Nitro replaces these flags before bundling; our development SQLite driver
    // and local migrator are absent from production Workers and prerender builds.
    if (import.meta.dev && !import.meta.prerender) {
        const { openDevelopmentDB } = await import('../database/development')
        const local = openDevelopmentDB({ databasePath: process.env.LIRY24_DEV_DB_PATH })
        setDevelopmentDB(local.database)
        nitroApp.hooks.hook('close', () => {
            if (getDevelopmentDB() === local.database) setDevelopmentDB()
            local.close()
        })
        console.info(`[database] Local development SQLite ready: ${local.path}`)
    }

    useServerHooks().hook('site-admin:database', (context) => {
        const db = useDB(context.event)
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

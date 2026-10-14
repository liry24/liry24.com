import type {} from '@liria24/site-admin/nuxt'
import { useServerHooks } from 'nuxt/server'

import { getDevelopmentDB, setDevelopmentDB } from '../database'
import { createAuthDatabase } from '../utils/authDatabase'

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
        context.authDatabase = createAuthDatabase(context.event, context.platformContext)
    })
})

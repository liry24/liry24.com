import { getDevelopmentDB, setDevelopmentDB } from '../database'

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
})

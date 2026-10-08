import type { D1Database } from '@cloudflare/workers-types'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import type { SiteAdminDatabaseContext } from '@liria24/site-admin/runtime/database'
import { createError, type RequestEvent } from 'nuxt/server'

import { createDB, getDevelopmentDB, type Database } from '../database'
import * as schema from '../database/schema'
import { getCloudflareEnvironment } from './cloudflareContext'

const adapters = new WeakMap<Database, ReturnType<typeof drizzleAdapter>>()

export const useDB = (event?: Pick<RequestEvent, 'context'>, platformContext?: object) => {
    if (import.meta.dev && !import.meta.prerender) {
        const database = getDevelopmentDB()
        if (!database)
            throw createError({
                status: 500,
                statusText: 'Local database startup has not completed',
            })
        return database
    }

    const d1 = getCloudflareEnvironment<{ DB?: D1Database }>(event, platformContext).DB

    if (!d1) throw createError({ status: 500, statusText: 'D1 binding is not configured' })

    return createDB(d1)
}

export const getSiteAdminDatabase = ({ event, platformContext }: SiteAdminDatabaseContext) => {
    const database = useDB(event, platformContext)
    let adapter = adapters.get(database)
    if (!adapter) {
        adapter = drizzleAdapter(database, { schema })
        adapters.set(database, adapter)
    }
    return adapter
}

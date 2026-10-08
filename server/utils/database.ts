import type { D1Database } from '@cloudflare/workers-types'
import { createError, type RequestEvent } from 'nuxt/server'

import { createDB, getDevelopmentDB } from '../database'

export const useDB = (event?: Pick<RequestEvent, 'context'>) => {
    if (import.meta.dev && !import.meta.prerender) {
        const database = getDevelopmentDB()
        if (!database)
            throw createError({
                status: 500,
                statusText: 'Local database startup has not completed',
            })
        return database
    }

    const d1 = getCloudflareEnvironment<{ DB?: D1Database }>(event).DB

    if (!d1) throw createError({ status: 500, statusText: 'D1 binding is not configured' })

    return createDB(d1)
}

import type { D1Database } from '@cloudflare/workers-types'
import { createError, type RequestEvent } from 'nuxt/server'

import { createDB } from '../database'

export const useDB = (event?: Pick<RequestEvent, 'context'>) => {
    const d1 = getCloudflareEnvironment<{ DB?: D1Database }>(event).DB

    if (!d1) throw createError({ status: 500, statusText: 'D1 binding is not configured' })

    return createDB(d1)
}

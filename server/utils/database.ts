import type { D1Database } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

import { createDB } from '../database'

export const useDB = (event?: H3Event) => {
    const d1 = getCloudflareEnvironment<{ DB?: D1Database }>(event).DB

    if (!d1) throw createError({ statusCode: 500, statusMessage: 'D1 binding is not configured' })

    return createDB(d1)
}

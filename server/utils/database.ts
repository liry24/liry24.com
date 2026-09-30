import type { D1Database } from '@cloudflare/workers-types'
import { createDB } from '@repo/database'
import type { H3Event } from 'h3'

export const useDB = (event?: H3Event) => {
    const d1 = (
        event
            ? getCloudflareEnvironment<{ DB?: D1Database }>(event)
            : (process.env as unknown as { DB?: D1Database })
    ).DB

    if (!d1) throw createError({ statusCode: 500, statusMessage: 'D1 binding is not configured' })

    return createDB(d1)
}

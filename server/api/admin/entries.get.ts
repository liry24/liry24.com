import { defineEventHandler, getQuery, createError } from 'nuxt/server'
import { z } from 'zod'

import { listAdminEntries } from '../../utils/entryList'

export default defineEventHandler(async (event) => {
    const input = z
        .object({
            model: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
            q: z.string().max(100).optional(),
            limit: z.coerce.number().int().min(1).max(1000).default(50),
            offset: z.coerce.number().int().nonnegative().default(0),
        })
        .safeParse(getQuery(event))
    if (!input.success) throw createError({ status: 400, statusText: 'Invalid entry query' })
    const session = await requireAdminPermission(event, {
        [`liti:model:${input.data.model}`]: ['readDraft'],
    })
    return await listAdminEntries(input.data.model, session.user, input.data)
})

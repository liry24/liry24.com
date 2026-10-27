import { assertIdentity, authorize } from '@litijs/model'
import { sql } from 'drizzle-orm'
import { createError, defineEventHandler, readBody } from 'nuxt/server'
import { db } from 'vite-hub/database/drizzle'
import { z } from 'zod'

import runtime from '#liti/runtime'

import { tables } from '../../database/records'

export default defineEventHandler(async (event) => {
    await assertAppOrigin(event.req)
    const parsed = z
        .object({
            model: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
            revision: z.string().nullable(),
            entries: z
                .array(
                    z.object({ id: z.string(), version: z.number().int().positive().optional() }),
                )
                .min(1)
                .max(1000),
        })
        .safeParse(await readBody(event))
    if (!parsed.success) throw createError({ status: 400, statusText: 'Invalid record order' })
    const input = parsed.data
    const session = await requireAdminPermission(event, {
        [`liti:model:${input.model}`]: ['reorder'],
    })
    const model = runtime.definition(input.model)
    const ids = input.entries.map((entry) => entry.id)
    for (const id of ids) assertIdentity(id)
    if (new Set(ids).size !== ids.length)
        throw createError({ status: 400, statusText: 'Duplicate entry' })
    for (const id of ids) await authorize(model, { actor: session.user, action: 'reorder', id })
    if (model.storage === 'content') {
        if (!input.revision)
            throw createError({ status: 409, statusText: 'Reload before reordering' })
        return await runtime.content.reorder(input.model, ids, {
            actor: session.user,
            ifHead: input.revision,
        })
    }
    const table = Object.entries(tables).find(([name]) => name === input.model)?.[1]
    if (!table || !model.fields.order || input.entries.some((entry) => !entry.version))
        throw createError({ status: 400, statusText: 'Invalid record order' })
    const positions = sql.join(
        input.entries.map((entry, index) => sql`WHEN ${entry.id} THEN ${index}`),
        sql` `,
    )
    const versions = sql.join(
        input.entries.map((entry) => sql`WHEN ${entry.id} THEN ${entry.version}`),
        sql` `,
    )
    const selected = sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
    )
    // One SQL statement checks every reviewed version before changing any row.
    const changed = await db.all<{ id: string }>(
        sql`WITH reviewed AS MATERIALIZED (SELECT COUNT(*) AS matched FROM ${table} WHERE "id" IN (${selected}) AND "version" = CASE "id" ${versions} END) UPDATE ${table} SET "order" = CASE "id" ${positions} END, "version" = "version" + 1, "updated_at" = ${new Date().toISOString()} WHERE "id" IN (${selected}) AND (SELECT COUNT(*) FROM ${table}) = ${ids.length} AND (SELECT matched FROM reviewed) = ${ids.length} RETURNING "id"`,
    )
    if (changed.length !== ids.length)
        throw createError({ status: 409, statusText: 'Records changed. Reload before reordering.' })
    for (const id of ids)
        await modelActivity({ action: 'reorder', model: input.model, id, actor: session.user })
    return { changed: changed.length }
})

import { contentSchedulesRef } from 'vite-hub/content'
import { isWorkspaceConflict } from 'vite-hub/workspace'
import { useWorkspaceFiles } from 'vite-hub/workspace/files'
import { z } from 'zod'

import content from '../../content.js'

const payloadSchema = z.object({
    model: z.enum([...contentCollectionNames.filter((name) => name !== 'posts'), 'games']),
    from: z.array(z.string().min(1)),
    to: z.array(z.string().min(1)),
})

const jsonDocument = z.looseObject({})

function orderConflict() {
    return createError({
        status: 409,
        statusText: 'The list changed. Review the latest order and try again.',
    })
}

function orderChanges(
    items: Array<{ id: string; data: { order?: number } }>,
    { from, to }: Pick<z.infer<typeof payloadSchema>, 'from' | 'to'>,
) {
    const expectedIds = new Set(from)
    if (
        from.length !== to.length ||
        expectedIds.size !== from.length ||
        new Set(to).size !== to.length ||
        to.some((id) => !expectedIds.has(id))
    ) {
        throw createError({
            status: 400,
            statusText: 'Provide the same unique items in both orders.',
        })
    }
    if (items.length === to.length && items.every(({ id }, index) => id === to[index])) {
        return []
    }
    if (items.length !== from.length || items.some(({ id }, index) => id !== from[index])) {
        throw orderConflict()
    }
    const current = new Map(items.map(({ id, data }) => [id, data.order ?? 0]))
    const ranks = Array.from(current.values())
    const distinctRanks = new Set(ranks).size === ranks.length
    return to.flatMap((id, index) => {
        const order = distinctRanks ? (ranks[index] ?? index) : index
        return current.get(id) === order ? [] : [{ id, order }]
    })
}

export default defineEventHandler(async (event) => {
    const session = await requireAdminSession(event)
    if (!event.req.headers.get('content-type')?.startsWith('application/json')) {
        throw createError({ status: 415, statusText: 'JSON required' })
    }
    const parsed = payloadSchema.safeParse(await readBody(event))
    if (!parsed.success) {
        throw createError({ status: 400, statusText: 'Invalid reorder payload.' })
    }
    event.res.headers.set('Cache-Control', 'private, no-store')
    const input = parsed.data

    if (input.model === 'games') {
        const catalog = gameCatalog()
        const items = await catalog.listOrdered()
        const changes = orderChanges(items, input)
        const expected = items.map(({ id, data }) => ({ id, order: data.order ?? 0 }))
        if (changes.length && !(await catalog.reorder(expected, changes))) {
            throw orderConflict()
        }
        return { ok: true }
    }

    const collection = content.collection(input.model)
    const { history } = useWorkspaceFiles('content', { mode: 'write' })
    const [draft, schedulesHead] = await Promise.all([
        history.head({ ref: 'draft' }),
        history.head({ ref: contentSchedulesRef }),
    ])
    const published = draft ? null : await history.head({ ref: 'published' })
    const { items, schedules } = await listAdminCollection(input.model)
    const changes = orderChanges(items, input)
    if (!changes.length) {
        return { ok: true }
    }
    const revision = draft ?? published
    if (!revision) {
        throw orderConflict()
    }

    const scheduledIds = new Set(
        schedules
            .filter((schedule) => schedule.status !== 'failed')
            .flatMap((schedule) => schedule.expect)
            .filter((item) => item.collection === input.model)
            .map((item) => item.id),
    )
    if (changes.some(({ id }) => scheduledIds.has(id))) {
        throw createError({
            status: 409,
            statusText: 'Unschedule affected items before reordering.',
        })
    }
    const put = Object.fromEntries(
        await Promise.all(
            changes.map(async ({ id, order }) => {
                const raw = await collection.raw(id, { revision: revision.id })
                if (!raw) {
                    throw orderConflict()
                }
                const data = jsonDocument.parse(JSON.parse(raw.text))
                return [raw.path, JSON.stringify({ ...data, order }, null, 2) + '\n'] as const
            }),
        ),
    )

    try {
        const ifHeads = {
            [contentSchedulesRef]: schedulesHead?.id ?? null,
        }
        const options = {
            ref: 'draft',
            ifHead: draft?.id ?? null,
            ifHeads: published ? { ...ifHeads, published: published.id } : ifHeads,
            message: `Reorder ${input.model}`,
            metadata: { actorUserId: session.user.id },
        }
        if (draft) {
            await history.commit({ ...options, changes: { put } })
        } else {
            // Match Content's draft fallback when the workspace only has a published ref.
            const view = await history.open(revision.id)
            const entries = (await view.list('', { recursive: true })).filter(
                (entry) => entry.type === 'file',
            )
            const files = Object.fromEntries(
                await Promise.all(
                    entries.map(
                        async ({ path }) =>
                            [
                                path,
                                put[path] ?? (await view.readFile(path, { encoding: 'binary' })),
                            ] as const,
                    ),
                ),
            )
            await history.commit({ ...options, files })
        }
    } catch (error) {
        if (isWorkspaceConflict(error)) {
            throw orderConflict()
        }
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'CONTENT_LEASE_HELD'
        ) {
            throw createError({
                status: 409,
                statusText: 'An item is being edited. Try again after it is saved.',
            })
        }
        throw error
    }
    return { ok: true }
})

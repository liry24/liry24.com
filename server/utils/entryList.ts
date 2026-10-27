import { authorize, type Actor } from '@litijs/model'
import { useWorkspace } from 'vite-hub/workspace'

import runtime from '#liti/runtime'

export async function listAdminEntries(
    name: string,
    actor: Actor,
    input: { q?: string; limit: number; offset: number },
): Promise<{ items: AdminEntry[]; total: number; revision: string | null }> {
    const model = runtime.definition(name)
    await authorize(model, { actor, action: 'readDraft' })
    const entries: AdminEntry[] = []
    const revision =
        model.storage === 'content'
            ? ((await useWorkspace('content', { mode: 'read' }).history.head({ ref: 'draft' }))
                  ?.id ?? null)
            : null
    if (model.storage === 'records') {
        for (let offset = 0; ; offset += 1000) {
            const page = await runtime.records.query(name, { limit: 1000, offset })
            for (const row of page.items) {
                const entry = await runtime.records.readDraft(name, row.id, { actor })
                if (entry)
                    entries.push({
                        ...entry,
                        model: name,
                        order: Number(entry.data.order ?? 0),
                        status: 'immediate',
                    })
            }
            if (offset + page.items.length >= page.total) break
        }
    } else {
        const collection = runtime.nativeContent.collection(name)
        async function documents(ref: 'draft' | 'published') {
            const found = new Map<
                string,
                {
                    id: string
                    digest: string
                    data: Record<string, unknown>
                    updatedAt: string | null
                }
            >()
            let cursor: string | undefined
            do {
                const page = await collection.list({
                    ref,
                    limit: 1000,
                    ...(cursor ? { cursor } : {}),
                })
                for (const document of page.items) found.set(document.id, document)
                cursor = page.nextCursor ?? undefined
            } while (cursor)
            return found
        }
        const [current, published] = await Promise.all([documents('draft'), documents('published')])
        for (const key of new Set([...current.keys(), ...published.keys()])) {
            const [id, locale] = key.split('/')
            if (!id || locale !== (model.locales?.default ?? 'und')) continue
            await authorize(model, { actor, action: 'readDraft', id, locale })
            const draft = current.has(key)
                ? await runtime.content.readDraft(
                      name,
                      id,
                      { actor },
                      locale,
                      revision ? { revision } : {},
                  )
                : null
            const live = published.get(key)
            const state = await runtime.content.inspect(name, id, { actor }, locale)
            const scheduledAt = state.schedules.map((job) => job.at).sort()[0]
            if (draft) {
                const { body: _body, ...row } = draft
                entries.push({
                    ...row,
                    scheduledAt,
                    status: !live
                        ? 'draft'
                        : live.digest === draft.digest
                          ? 'published'
                          : 'changed',
                })
            } else if (live)
                entries.push({
                    id,
                    model: name,
                    data: Object.fromEntries(
                        Object.entries(live.data).filter(([key]) => !key.startsWith('_liti')),
                    ),
                    updatedAt: live.updatedAt,
                    order: Number(live.data._litiOrder ?? 0),
                    status: 'published',
                })
        }
    }
    const query = input.q?.trim().toLocaleLowerCase() ?? ''
    const selected = entries.filter(
        (entry) =>
            !query ||
            Object.values(entry.data).some(
                (value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query),
            ),
    )
    selected.sort((a, b) =>
        name === 'posts'
            ? (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id)
            : a.order - b.order || a.id.localeCompare(b.id),
    )
    return {
        items: selected.slice(input.offset, input.offset + input.limit),
        total: selected.length,
        revision,
    }
}

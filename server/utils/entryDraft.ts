import type { ContentRef, ContentWriteOptions } from '@vite-hub/content'

type EntryKey = 'slug' | 'periodKey'

export async function saveEntryDraft<
    Key extends EntryKey,
    Data extends Record<Key, string> & { order: number },
>(
    collection: {
        list: (options?: { ref?: ContentRef; limit?: number; cursor?: string }) => Promise<{
            items: Array<{ id: string; data: Data }>
            nextCursor: string | null
        }>
        get: (
            id: string,
            options: { ref: 'draft' },
        ) => Promise<{ data: Data; digest: string } | null>
        save: (
            id: string,
            input: { data: NoInfer<Data>; body?: string },
            options?: ContentWriteOptions,
        ) => Promise<{ digest: string }>
    },
    options: {
        id?: string
        key: Key
        label: string
        data: { order?: number } & Partial<Record<Key, string>>
        body?: string
        fields: (slug: string, order: number, previous?: NoInfer<Data>) => NoInfer<Data>
        idPrefix?: string
        sameScope?: (data: NoInfer<Data>) => boolean
        allowGeneratedKey?: (slug: string) => boolean
        validate?: (id: string, data: NoInfer<Data>, previous?: NoInfer<Data>) => Promise<void>
    },
) {
    const { key, data } = options
    const manualKey = data[key]
    let id: string
    let slug: string
    let order: number
    let digest: string | null = null
    let previous: Data | undefined

    if (options.id?.trim()) {
        id = validateDocumentId(options.id)
        const draft = await collection.get(id, { ref: 'draft' })
        previous = draft?.data
        const currentKey = manualKey ?? previous?.[key]
        if (currentKey === undefined)
            throw createError({ status: 404, statusText: 'Document not found' })

        slug = currentKey
        digest = draft?.digest ?? null
        order =
            data.order ??
            previous?.order ??
            appendOrder(await listAllCollectionItems(collection, 'draft'))
    } else {
        const base = manualKey ?? (await generateEntrySlug(options.label))
        const entries = await listAllCollectionItems(collection, 'draft')
        const ids = new Set(entries.map((entry) => entry.id))
        const keys = new Set<string>(
            entries
                .filter((entry) => !options.sameScope || options.sameScope(entry.data))
                .map((entry) => entry.data[key]),
        )
        const makeId = (value: string) => {
            const prefix = options.idPrefix ?? ''
            return buildDocumentId(
                (manualKey === undefined ? prefix.slice(0, 100 - value.length) : prefix) + value,
            )
        }
        slug = base
        id = makeId(slug)
        if (manualKey === undefined) {
            for (
                let suffix = 2;
                ids.has(id) || keys.has(slug) || options.allowGeneratedKey?.(slug) === false;
                suffix++
            ) {
                slug = `${base}_${suffix}`
                id = makeId(slug)
            }
        } else if (ids.has(id) || keys.has(slug)) {
            throw createError({
                status: 409,
                statusText: 'An entry with this slug already exists.',
            })
        }
        order = data.order ?? appendOrder(entries)
    }

    const fields = options.fields(slug, order, previous)
    await options.validate?.(id, fields, previous)
    const saved = await collection.save(
        id,
        { data: fields, body: options.body },
        { ifDigest: digest },
    )
    return { id, slug, digest: saved.digest }
}

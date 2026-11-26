import type { ContentDocumentStatus, ContentRef, ContentSchedule } from '@vite-hub/content'

import content from '#server/content'

type CollectionDocumentData =
    | PostData
    | WorkData
    | ArtData
    | CareerData
    | SkillData
    | GameStatsRecordData
    | SocialData

interface CollectionDocumentItem<TData = CollectionDocumentData> {
    id: string
    url?: string | null
    updatedAt?: string | null
    data: TData
}

interface AdminContentSummary {
    id: string
    data: CollectionDocumentData
    status: ContentDocumentStatus | null
    schedule: ContentSchedule | null
}

interface AdminContentDocument {
    id: string
    data: CollectionDocumentData
    body: string
    status: ContentDocumentStatus | null
    schedules: Array<ContentSchedule>
}

interface ListableCollection<TData> {
    list: (options?: { ref?: ContentRef; limit?: number; cursor?: string }) => Promise<{
        items: Array<CollectionDocumentItem<TData>>
        nextCursor: string | null
    }>
}

export function parseCollectionName(raw: string | undefined): ContentCollectionName {
    const matched = contentCollectionNames.find((name) => name === raw)
    if (!matched) throw createError({ status: 404, statusText: 'Collection not found' })

    return matched
}

export function readDecodedRouterParam(
    event: Parameters<typeof getRouterParam>[0],
    name: string,
    notFoundText: string,
): string {
    const raw = getRouterParam(event, name)
    if (!raw) throw createError({ status: 404, statusText: notFoundText })

    try {
        return decodeURIComponent(raw)
    } catch {
        throw createError({ status: 404, statusText: notFoundText })
    }
}

export function appendOrder(items: Array<{ data: { order?: number } }>) {
    const last = items.reduce((current, { data }) => Math.max(current, data.order ?? 0), -1)
    return last < Number.MAX_SAFE_INTEGER ? Math.floor(last) + 1 : last
}

export async function listAllCollectionItems<TData>(
    collection: ListableCollection<TData>,
    ref: ContentRef = 'published',
): Promise<Array<CollectionDocumentItem<TData>>> {
    const items: Array<CollectionDocumentItem<TData>> = []
    let cursor: string | undefined
    for (;;) {
        const page = cursor
            ? await collection.list({ ref, limit: 1000, cursor })
            : await collection.list({ ref, limit: 1000 })
        for (const { id, url, updatedAt, data } of page.items)
            items.push({ id, url, updatedAt, data })

        if (!page.nextCursor || page.items.length === 0) return items

        cursor = page.nextCursor
    }
}

export async function listCollectionByName(
    name: ContentCollectionName,
    ref: ContentRef,
): Promise<Array<CollectionDocumentItem>> {
    switch (name) {
        case 'posts': {
            return await listAllCollectionItems(content.collection('posts'), ref)
        }
        case 'works': {
            return await listAllCollectionItems(content.collection('works'), ref)
        }
        case 'arts': {
            return await listAllCollectionItems(content.collection('arts'), ref)
        }
        case 'careers': {
            return await listAllCollectionItems(content.collection('careers'), ref)
        }
        case 'skills': {
            return await listAllCollectionItems(content.collection('skills'), ref)
        }
        case 'gameStats': {
            return await listAllCollectionItems(content.collection('gameStats'), ref)
        }
        case 'socials': {
            return await listAllCollectionItems(content.collection('socials'), ref)
        }
    }
}

export async function listAdminCollection(name: ContentCollectionName): Promise<{
    items: Array<AdminContentSummary>
    schedules: Array<ContentSchedule>
}> {
    const col = content.collection(name)
    const [docs, statuses, activeSchedules] = await Promise.all([
        listCollectionByName(name, 'draft'),
        col.status(),
        content.schedules({ collection: name }),
    ])

    const statusByDocId = new Map(statuses.map((entry) => [entry.id, entry]))
    const scheduleByDocId = new Map<string, ContentSchedule>()
    for (const entry of activeSchedules) {
        for (const item of entry.expect) {
            if (item.collection === name && !scheduleByDocId.has(item.id))
                scheduleByDocId.set(item.id, entry)
        }
    }

    const items: Array<AdminContentSummary> = docs.map((doc) => ({
        id: doc.id,
        data: doc.data,
        status: statusByDocId.get(doc.id) ?? null,
        schedule: scheduleByDocId.get(doc.id) ?? null,
    }))

    items.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))

    return { items, schedules: activeSchedules }
}

export async function getAdminDocument(
    name: ContentCollectionName,
    id: string,
): Promise<AdminContentDocument | null> {
    const col = content.collection(name)
    const doc = await col.get(id, { ref: 'draft' })
    if (!doc) return null

    const [status, schedules] = await Promise.all([
        col.status(id),
        content.schedules({ collection: name, id }),
    ])
    return {
        id: doc.id,
        data: doc.data,
        body: doc.body,
        status,
        schedules,
    }
}

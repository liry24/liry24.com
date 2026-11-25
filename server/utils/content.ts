import type { ContentDocumentStatus, ContentRef, ContentSchedule } from '@vite-hub/content'

import type {
    ArtData,
    CareerData,
    ContentCollectionName,
    GameStatsRecordData,
    PostData,
    SkillData,
    SocialData,
    WorkData,
} from '../../shared/schemas/content.js'
import content from '../content.js'

export type CollectionDocumentData =
    | PostData
    | WorkData
    | ArtData
    | CareerData
    | SkillData
    | GameStatsRecordData
    | SocialData

export interface CollectionDocumentItem<TData = CollectionDocumentData> {
    id: string
    url?: string | null
    data: TData
}

export interface AdminContentSummary {
    id: string
    title: string
    data: CollectionDocumentData
    status: ContentDocumentStatus | null
    schedule: ContentSchedule | null
}

export interface AdminContentDocument {
    id: string
    data: CollectionDocumentData
    body: string
    status: ContentDocumentStatus | null
    schedules: Array<ContentSchedule>
}

interface ListableCollection<TData> {
    list: (options?: { ref?: ContentRef; limit?: number; cursor?: string }) => Promise<{
        items: Array<{ id: string; url?: string | null; data: TData }>
        nextCursor: string | null
    }>
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
        for (const item of page.items) {
            items.push({ id: item.id, url: item.url, data: item.data })
        }
        if (!page.nextCursor || page.items.length === 0) {
            return items
        }
        cursor = page.nextCursor
    }
}

async function listCollectionByName(
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
    const docs = await listCollectionByName(name, 'draft')

    const activeSchedules = await content.schedules({ collection: name })
    const scheduleByDocId = new Map<string, ContentSchedule>()
    for (const entry of activeSchedules) {
        for (const item of entry.expect) {
            if (item.collection === name && !scheduleByDocId.has(item.id)) {
                scheduleByDocId.set(item.id, entry)
            }
        }
    }

    const items = await Promise.all(
        docs.map(async (doc) => {
            const status = await col.status(doc.id)
            const title =
                'title' in doc.data && typeof doc.data.title === 'string' ? doc.data.title : doc.id
            return {
                id: doc.id,
                title: title || doc.id,
                data: doc.data,
                status,
                schedule: scheduleByDocId.get(doc.id) ?? null,
            }
        }),
    )

    items.sort((a, b) => {
        const orderA = 'order' in a.data ? Number(a.data.order ?? 0) : 0
        const orderB = 'order' in b.data ? Number(b.data.order ?? 0) : 0
        return orderA - orderB || a.id.localeCompare(b.id)
    })

    return { items, schedules: activeSchedules }
}

export async function getAdminDocument(
    name: ContentCollectionName,
    id: string,
): Promise<AdminContentDocument | null> {
    const col = content.collection(name)
    const doc = await col.get(id, { ref: 'draft' })
    if (!doc) {
        return null
    }
    const [status, schedules] = await Promise.all([
        col.status(id),
        content.schedules({ collection: name, id }),
    ])
    return {
        id: doc.id,
        data: doc.data,
        body: typeof doc.body === 'string' ? doc.body : '',
        status,
        schedules,
    }
}

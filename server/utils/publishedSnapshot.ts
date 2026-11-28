import type { RequestEvent } from 'nuxt/server'

import content from '#server/content'

type PublishedPost = Awaited<ReturnType<typeof listAllCollectionItems<PostData>>>[number]

interface PublishedPostsSnapshot {
    revision: string | null
    items: Array<PublishedPost>
    bySlug: Map<string, PublishedPost>
    byId: Map<string, PublishedPost>
}

interface SnapshotCache<T> {
    current?: { revision: string; pending: Promise<T | undefined> }
}

const postsCache: SnapshotCache<PublishedPostsSnapshot> = {}
const socialsCache: SnapshotCache<{ revision: string; bySlug: Map<string, string> }> = {}
const parsedPosts = new Map<string, ReturnType<typeof parsePostContent>>()

export function getPublishedRevision() {
    return content.head('published')
}

async function readPublishedSnapshot<T>(
    cache: SnapshotCache<T>,
    load: (revision: string) => Promise<T>,
): Promise<T | undefined> {
    for (;;) {
        const previous = cache.current
        const revision = await getPublishedRevision()
        if (revision === null) {
            if (cache.current === previous) cache.current = undefined
            return
        }

        if (cache.current?.revision !== revision) {
            if (cache.current !== previous) continue

            // Collection lists follow the ref, so retry if it moves while loading.
            const pending = load(revision).then(
                async (snapshot) =>
                    (await getPublishedRevision()) === revision ? snapshot : undefined,
                async (error: unknown) => {
                    if ((await getPublishedRevision()) === revision) throw error
                },
            )
            cache.current = { revision, pending }
        }

        const current = cache.current
        let snapshot: T | undefined
        try {
            snapshot = await current.pending
            if (snapshot !== undefined) return snapshot
        } finally {
            if (snapshot === undefined && cache.current === current) cache.current = undefined
        }
    }
}

export async function getPublishedPostsSnapshot(): Promise<PublishedPostsSnapshot> {
    const snapshot = await readPublishedSnapshot(postsCache, async (revision) => {
        const items = await listAllCollectionItems(content.collection('posts'), 'published')
        const bySlug = new Map<string, PublishedPost>()
        const byId = new Map<string, PublishedPost>()
        for (const item of items) {
            if (!bySlug.has(item.data.slug)) bySlug.set(item.data.slug, item)
            byId.set(item.id, item)
        }
        return { revision, items, bySlug, byId }
    })
    return snapshot ?? { revision: null, items: [], bySlug: new Map(), byId: new Map() }
}

export async function getPublishedSocialsMap(): Promise<Map<string, string>> {
    const snapshot = await readPublishedSnapshot(socialsCache, async (revision) => {
        const items = await listAllCollectionItems(content.collection('socials'), 'published')
        const bySlug = new Map<string, string>()
        for (const { data } of items) {
            if (!bySlug.has(data.slug)) bySlug.set(data.slug, data.href)
        }
        return { revision, bySlug }
    })
    return snapshot?.bySlug ?? new Map()
}

export function getParsedPostContent(digest: string | undefined, body: string) {
    if (digest === undefined) return parsePostContent(body)

    const cached = parsedPosts.get(digest)
    if (cached) return cached

    const pending = parsePostContent(body).catch((error: unknown) => {
        if (parsedPosts.get(digest) === pending) parsedPosts.delete(digest)
        throw error
    })
    parsedPosts.set(digest, pending)
    if (parsedPosts.size > 200) {
        const oldest = parsedPosts.keys().next().value
        if (oldest !== undefined) parsedPosts.delete(oldest)
    }
    return pending
}

export function applyPublicCacheHeaders(
    event: RequestEvent,
    etagSeed: string,
    maxAge = 0,
    sMaxAge = 60,
    swr = 300,
): boolean {
    const tag = `"${etagSeed}"`
    event.res.headers.set(
        'Cache-Control',
        `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    )
    event.res.headers.set('ETag', `W/${tag}`)

    const ifNoneMatch = event.req.headers.get('If-None-Match')
    if (
        ifNoneMatch?.trim() !== '*' &&
        !ifNoneMatch?.split(',').some((entry) => entry.trim().replace(/^W\//u, '') === tag)
    )
        return false

    event.res.status = 304
    return true
}

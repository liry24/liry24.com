import type { ContentDocument } from '@vite-hub/content'
import { sql } from 'drizzle-orm'

import content from '#server/content'

const maxPostSlugLength = 48
const reservedSlugs = new Set(['cards', 'new'])

export const isPostSlugAllowed = (slug: string) => !reservedSlugs.has(slug.toLowerCase())

export function fallbackPostSlug(label: string) {
    return fallbackEntrySlug(label, maxPostSlugLength, 'kebab')
}

export function suffixPostSlug(base: string, suffix: number) {
    const ending = `-${suffix}`
    return base.slice(0, maxPostSlugLength - ending.length).replace(/-$/u, '') + ending
}

export function postSlugConflict() {
    return createError({ status: 409, statusText: 'A post with this slug already exists.' })
}

export async function listPostSlugOwners() {
    const { db, schema } = useDatabase('default')
    const claims = await db.select().from(schema.postSlugs)
    return new Map(claims.map(({ slug, postId }) => [slug, postId]))
}

export async function claimPostSlugs(id: string, ...slugs: Array<string>) {
    const { db, schema } = useDatabase('default')
    const table = schema.postSlugs
    const paths = [...new Set([id, ...slugs].map((slug) => slug.toLowerCase()))]
    const claimed = await db.all<{ slug: string }>(sql`
        WITH candidates AS (SELECT value AS slug FROM json_each(${JSON.stringify(paths)}))
        INSERT INTO ${table} (slug, post_id)
        SELECT slug, ${id} FROM candidates
        WHERE NOT EXISTS (
            SELECT 1 FROM ${table}
            JOIN candidates AS candidate ON candidate.slug = ${table.slug}
            WHERE ${table.postId} <> ${id}
        )
        ON CONFLICT (slug) DO UPDATE SET post_id = excluded.post_id
        RETURNING slug
    `)
    return claimed.length === paths.length
}

function postPublishAIEnabled() {
    const env = useServerEnv()
    return !import.meta.dev && env.APP_ENV === 'production' && env.LIRY24_POST_PUBLISH_AI === 'true'
}

export async function preparePostSlug(post: ContentDocument<PostData>) {
    const posts = content.collection('posts')
    const [drafts, published] = await Promise.all([
        listAllCollectionItems(posts, 'draft'),
        listAllCollectionItems(posts, 'published'),
    ])
    const occupied = new Set<string>()
    for (const entry of [...drafts, ...published]) {
        if (entry.id === post.id) continue
        occupied.add(entry.id.toLowerCase())
        if (typeof entry.data.slug === 'string') occupied.add(entry.data.slug.toLowerCase())
    }
    const previous = published.find((entry) => entry.id === post.id)
    if (
        occupied.has(post.id.toLowerCase()) ||
        !(await claimPostSlugs(post.id, ...(previous ? [previous.data.slug] : [])))
    )
        throw postSlugConflict()

    const { generateSlugOnPublish, ...data } = post.data
    let slug = data.slug
    const suggested =
        generateSlugOnPublish && !previous && postPublishAIEnabled()
            ? await suggestEntrySlug(data.plainTitle || data.title, maxPostSlugLength, 'kebab')
            : undefined
    if (suggested) {
        slug = suggested
        for (let suffix = 2; ; suffix++) {
            if (
                isPostSlugAllowed(slug) &&
                !occupied.has(slug) &&
                (await claimPostSlugs(post.id, slug))
            )
                break

            slug = suffixPostSlug(suggested, suffix)
        }
    } else if (occupied.has(slug.toLowerCase()) || !(await claimPostSlugs(post.id, slug)))
        throw postSlugConflict()

    if (!generateSlugOnPublish) return post.digest

    const saved = await posts.save(
        post.id,
        { data: { ...data, slug }, body: post.body },
        { ifDigest: post.digest },
    )
    return saved.digest
}

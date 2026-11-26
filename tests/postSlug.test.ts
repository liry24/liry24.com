import type { ContentDocument } from '@vite-hub/content'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { postSlugs } from '../server/databases/default/schema'
import { preparePostSlug } from '../server/utils/postSlug'
import type { PostData } from '../shared/types/content'
import { openTestDatabase } from './helpers/database'

const { list, save, suggestEntrySlug, useDatabase, useServerEnv } = vi.hoisted(() => ({
    list: vi.fn(),
    save: vi.fn<(id: string, input: { data: PostData }) => Promise<{ digest: string }>>(),
    suggestEntrySlug: vi.fn(),
    useDatabase: vi.fn(),
    useServerEnv: vi.fn(),
}))

vi.mock('#server/content', () => ({ default: { collection: () => ({ list, save }) } }))
vi.mock('vite-hub/database', () => ({ useDatabase }))
vi.mock('vite-hub/env', () => ({ useServerEnv }))
vi.mock('../server/utils/entrySlug', () => ({ suggestEntrySlug }))

let database: ReturnType<typeof openTestDatabase>

beforeEach(() => {
    vi.resetAllMocks()
    database = openTestDatabase()
    useDatabase.mockReturnValue({ db: drizzle({ client: database.sqlite }), schema: { postSlugs } })
    useServerEnv.mockReturnValue({ APP_ENV: 'production', LIRY24_POST_PUBLISH_AI: 'true' })
    list.mockResolvedValue({ items: [], nextCursor: null })
    save.mockResolvedValue({ digest: 'prepared' })
})

afterEach(() => database.close())

function draft(id: string): ContentDocument<PostData> {
    return {
        id,
        collection: 'posts',
        path: `content/posts/${id}.md`,
        digest: 'reviewed',
        revision: 'draft-revision',
        updatedAt: null,
        body: 'Intro.',
        data: {
            title: 'Original',
            plainTitle: 'Original',
            slug: id,
            generateSlugOnPublish: true,
            order: 0,
            gameMentions: [],
            tags: [],
        },
    }
}

test('keeps generated post slugs short and unique across past and concurrent posts', async () => {
    const suggestion = 'a'.repeat(48)
    list.mockImplementation(({ ref }: { ref: string }) => ({
        items: ref === 'published' ? [{ id: 'old', data: { slug: suggestion } }] : [],
        nextCursor: null,
    }))
    suggestEntrySlug.mockResolvedValue(suggestion)

    await Promise.all([preparePostSlug(draft('one')), preparePostSlug(draft('two'))])

    expect(suggestEntrySlug).toHaveBeenCalledWith('Original', 48, 'kebab')
    const slugs = save.mock.calls.map(([, input]) => input.data.slug)
    expect(slugs.toSorted()).toEqual([`${'a'.repeat(46)}-2`, `${'a'.repeat(46)}-3`])
    expect(save).toHaveBeenCalledWith('one', expect.anything(), { ifDigest: 'reviewed' })
})

test.each([
    { APP_ENV: 'dev', LIRY24_POST_PUBLISH_AI: 'true' },
    { APP_ENV: 'production', LIRY24_POST_PUBLISH_AI: 'false' },
])('keeps the draft slug without AI under %j', async (env) => {
    useServerEnv.mockReturnValue(env)
    await preparePostSlug(draft('local_slug'))
    expect(suggestEntrySlug).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith(
        'local_slug',
        expect.objectContaining({ data: expect.objectContaining({ slug: 'local_slug' }) }),
        { ifDigest: 'reviewed' },
    )
})

test('never requests another suggestion for an already published post', async () => {
    const post = draft('stable_slug')
    list.mockImplementation(({ ref }: { ref: string }) => ({
        items: ref === 'published' ? [post] : [],
        nextCursor: null,
    }))

    await preparePostSlug({ ...post, data: { ...post.data, title: 'Edited title' } })

    expect(suggestEntrySlug).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith(
        post.id,
        expect.objectContaining({ data: expect.objectContaining({ slug: 'stable_slug' }) }),
        { ifDigest: 'reviewed' },
    )
})

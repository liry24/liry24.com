import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdminManagementClient } from '@liria24/site-admin/client'
import { useSiteAdminForm } from '@liria24/site-admin/form'
import { createSiteAdmin, handleManagementRequest } from '@liria24/site-admin/server'
import { expect, test, vi } from 'vitest'
import { effectScope } from 'vue'

import {
    preparePostProofreading,
    preparePostPublication,
    postProposalStale,
    type PostEditorialProposal,
} from '../../app/utils/postEditorialFlow'
import { unpublishPost } from '../../app/utils/postUnpublish'
import { openDevelopmentDB } from '../../server/database/development'
import * as schema from '../../server/database/schema'
import { postMetadataModes, postPublicationSettings } from '../../shared/utils/postEditorial'
import config from '../../site-admin.config'
import { mockPostActions, postActionRequest, postActionResponse } from '../helpers/postAi'

const completion = postActionResponse
const initial = {
    title: 'Saved title',
    content: '# Saved body',
    tags: [],
    publication: { slug: 'auto', excerpt: 'auto' },
}
type Editor = ReturnType<typeof useSiteAdminForm>
type Client = ReturnType<typeof createSiteAdminManagementClient>
function currentDraft(editor: Editor) {
    return {
        entryId: editor.entryId.value,
        version: editor.version.value,
        draft: editor.draft.serialize(),
    }
}
function actionContext(editor: Editor, client: Client) {
    return {
        management: client,
        current: () => currentDraft(editor),
    }
}
function applyPublication(editor: Editor, candidate: PostEditorialProposal) {
    expect(postProposalStale(candidate, currentDraft(editor))).toBe(false)
    const modes = postMetadataModes(editor.form.state.values)
    if (modes.excerpt === 'auto') editor.form.setFieldValue('excerpt', candidate.data.excerpt)
    if (modes.slug === 'auto') editor.metadata.slug.value = candidate.slug
    editor.form.setFieldValue('publication', {
        ...postPublicationSettings(editor.form.state.values),
        publishedSlug: editor.metadata.slug.value,
    })
}
async function fixture(run: ReturnType<typeof vi.fn>) {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const scope = effectScope()
    const calls: { path: string; body?: Record<string, unknown> }[] = []
    const requests: Awaited<ReturnType<typeof postActionRequest>>[] = []
    let authorized = true
    let now = new Date('2026-10-09T00:00:00Z')
    const model = vi.fn(() => {
        throw new Error('Non-AI CRUD must not resolve a model')
    })
    const admin = createSiteAdmin({
        config: { ...config, ai: { ...config.ai, model } },
        database: drizzleAdapter(local.database, { schema }),
        authorize: () => (authorized ? { id: 'synthetic', roles: ['admin'] } : null),
        aiEnabled: true,
        now: () => now,
    })
    const client = createSiteAdminManagementClient({
        origin: 'http://synthetic.invalid',
        fetch: async (input, init) => {
            const request = new Request(String(input), init)
            if (request.method !== 'GET')
                calls.push({
                    path: new URL(request.url).pathname,
                    body: init?.body ? JSON.parse(String(init.body)) : undefined,
                })
            return handleManagementRequest(admin, request)
        },
    })
    const actions = mockPostActions(async (input, init) => {
        requests.push(await postActionRequest(input, init))
        return run()
    })
    const descriptor = (await client.models()).models.posts!
    const editor = scope.run(() =>
        useSiteAdminForm({
            descriptor,
            modelName: 'posts',
            client,
            defaultValues: structuredClone(initial),
        }),
    )!
    return {
        admin,
        client,
        editor,
        calls,
        requests,
        model,
        actions,
        publication: (target: Editor = editor) =>
            preparePostPublication(actionContext(target, client), actions.publication),
        proofreading: (target: Editor = editor) =>
            preparePostProofreading(actionContext(target, client), actions.proofread),
        setAuthorized: (value: boolean) => {
            authorized = value
        },
        setNow: (value: Date) => {
            now = value
        },
        close: () => {
            scope.stop()
            local.close()
        },
    }
}

test('an independent AI action publishes the unsaved candidate atomically and deduplicates publication', async () => {
    const run = vi.fn(async () =>
        completion({ slug: 'unsaved-title', excerpt: 'A short introduction in my voice.' }),
    )
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        expect(f.editor.serverError.value).toBeNull()
        expect(f.editor.metadata.slug.value).toBe('')
        const id = f.editor.entryId.value!
        const base = await f.admin.getEntry(id)
        f.editor.form.setFieldValue('title', 'Unsaved title')
        f.editor.form.setFieldValue('content', '# Unsaved body')
        f.editor.form.setFieldValue('tags', ['author-tag'])
        const candidate = await f.publication()
        expect(f.editor.form.state.values.content).toBe('# Unsaved body')
        expect((await f.admin.getEntry(id)).data.content).toBe('# Saved body')
        expect(JSON.stringify(f.requests[0]!.body.input)).toContain('Unsaved title')
        applyPublication(f.editor, candidate)
        const before = f.calls.length
        const [first, second] = await Promise.all([f.editor.publish(), f.editor.publish()])
        expect(first).toEqual(second)
        expect(first).toBeDefined()
        expect(f.calls.slice(before).map((call) => call.path)).toEqual([
            '/api/site-admin/entries/' + id + '/publish',
        ])
        expect(f.calls.at(-1)?.body).toMatchObject({
            expectedVersion: base.version,
            draft: {
                slug: 'unsaved-title',
                data: {
                    content: '# Unsaved body',
                    tags: ['author-tag'],
                    publication: { publishedSlug: 'unsaved-title' },
                },
            },
        })
        const published = await f.admin.getEntry(id)
        expect(published.version).toBe(base.version + 1)
        expect(published.currentRevisionId).toBe(published.publishedRevisionId)
        expect((await f.admin.listRevisions(id)).length).toBe(2)
        expect((await f.admin.getPublicEntry('posts', 'unsaved-title'))?.data).toMatchObject({
            title: 'Unsaved title',
            content: '# Unsaved body',
            excerpt: 'A short introduction in my voice.',
        })
        expect(run).toHaveBeenCalledTimes(1)
        expect(f.model).not.toHaveBeenCalled()
    } finally {
        f.close()
    }
})

test('AI failure keeps input and draft saving works, while manual publication bypasses AI', async () => {
    const run = vi.fn(async () => {
        throw new Error('Synthetic unavailable model')
    })
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        const id = f.editor.entryId.value!
        f.editor.form.setFieldValue('content', '# Input that must survive')
        await expect(f.publication()).rejects.toMatchObject({ code: 'SITE_ADMIN_AI_FAILED' })
        expect(f.editor.form.state.values.content).toBe('# Input that must survive')
        expect(f.calls.some((call) => call.path.endsWith('/publish'))).toBe(false)
        expect((await f.admin.getEntry(id)).publishedRevisionId).toBeNull()
        await f.editor.form.handleSubmit()
        expect(f.editor.serverError.value).toBeNull()
        expect((await f.admin.getEntry(id)).data.content).toBe('# Input that must survive')
        f.editor.form.setFieldValue('publication', { slug: 'manual', excerpt: 'manual' })
        f.editor.form.setFieldValue('excerpt', 'My own introduction.')
        f.editor.metadata.slug.value = 'manual-url'
        applyPublication(f.editor, await f.publication())
        expect(await f.editor.publish()).toBeDefined()
        expect((await f.admin.getPublicEntry('posts', 'manual-url'))?.data.excerpt).toBe(
            'My own introduction.',
        )
        expect(run).toHaveBeenCalledTimes(1)
        expect(f.model).not.toHaveBeenCalled()
    } finally {
        f.close()
    }
})

test('manual slug stays intact when only the excerpt is generated from unsaved content', async () => {
    const run = vi.fn(async () => completion({ excerpt: 'A short introduction in my voice.' }))
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        f.editor.form.setFieldValue('publication', { slug: 'manual', excerpt: 'auto' })
        f.editor.metadata.slug.value = 'author-chosen-url'
        f.editor.form.setFieldValue('content', '# My unsaved text')
        const candidate = await f.publication()
        expect(candidate.slug).toBe('author-chosen-url')
        expect(f.editor.form.state.values.excerpt).toBeUndefined()
        expect(Object.keys(f.requests[0]!.body.text.format.schema.properties)).toEqual(['excerpt'])
        expect(JSON.stringify(f.requests[0]!.body.input)).toContain('# My unsaved text')
        applyPublication(f.editor, candidate)
        expect(await f.editor.publish()).toBeDefined()
        expect((await f.admin.getPublicEntry('posts', 'author-chosen-url'))?.data).toMatchObject({
            content: '# My unsaved text',
            excerpt: 'A short introduction in my voice.',
        })
        expect(run).toHaveBeenCalledTimes(1)
    } finally {
        f.close()
    }
})

test('an edit after AI validation still fails the atomic publication version guard', async () => {
    const run = vi.fn(async () =>
        completion({ slug: 'candidate-url', excerpt: 'My introduction.' }),
    )
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        const id = f.editor.entryId.value!
        f.editor.form.setFieldValue('content', '# Local unsaved input')
        const candidate = await f.publication()
        const stored = await f.admin.getEntry(id)
        await f.admin.updateEntry(id, {
            expectedVersion: stored.version,
            data: { ...stored.data, content: '# Another author saved' },
        })
        applyPublication(f.editor, candidate)
        expect(await f.editor.publish()).toBeUndefined()
        expect(f.editor.conflict.value).toBe(true)
        expect(f.editor.form.state.values.content).toBe('# Local unsaved input')
        const current = await f.admin.getEntry(id)
        expect(current.data.content).toBe('# Another author saved')
        expect(current.publishedRevisionId).toBeNull()
        expect(await f.admin.getPublicEntry('posts', 'candidate-url')).toBeNull()
        expect(run).toHaveBeenCalledTimes(1)
    } finally {
        f.close()
    }
})

test('changed snapshots and concurrent edits reject AI publication without losing local input', async () => {
    let release!: (response: Response) => void
    const run = vi.fn(
        () =>
            new Promise<Response>((resolve) => {
                release = resolve
            }),
    )
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        const id = f.editor.entryId.value!
        const pending = expect(f.publication()).rejects.toMatchObject({
            code: 'SITE_ADMIN_CONFLICT',
        })
        await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
        f.editor.form.setFieldValue('content', '# Local edit during AI')
        release(completion({ slug: 'stale-output', excerpt: 'Stale introduction.' }))
        await pending
        const second = expect(f.publication()).rejects.toMatchObject({
            code: 'SITE_ADMIN_CONFLICT',
        })
        await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
        const current = await f.admin.getEntry(id)
        await f.admin.updateEntry(id, {
            expectedVersion: current.version,
            data: { ...current.data, content: '# Other author' },
        })
        release(completion({ slug: 'concurrent-output', excerpt: 'Concurrent introduction.' }))
        await second
        expect(f.editor.form.state.values.content).toBe('# Local edit during AI')
        expect((await f.admin.getEntry(id)).publishedRevisionId).toBeNull()
        await expect(f.publication()).rejects.toMatchObject({ code: 'SITE_ADMIN_CONFLICT' })
        expect(run).toHaveBeenCalledTimes(2)
        expect(f.calls.some((call) => call.path.endsWith('/publish'))).toBe(false)
    } finally {
        f.close()
    }
})

test('proofreading is review-only, preserves metadata, and denied management blocks inference', async () => {
    const run = vi.fn(async () => completion({ content: '# Proofread body' }))
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        const id = f.editor.entryId.value!
        f.editor.metadata.slug.value = 'manual-url'
        f.editor.form.setFieldValue('excerpt', 'My own introduction.')
        const suggestion = await f.proofreading()
        expect(f.editor.form.state.values.content).toBe('# Saved body')
        expect((await f.admin.getEntry(id)).data.content).toBe('# Saved body')
        expect(postProposalStale(suggestion, actionContext(f.editor, f.client).current())).toBe(
            false,
        )
        f.editor.form.setFieldValue('content', suggestion.data.content)
        expect(f.editor.form.state.values.content).toBe('# Proofread body')
        expect(f.editor.metadata.slug.value).toBe('manual-url')
        expect(f.editor.form.state.values.excerpt).toBe('My own introduction.')
        expect(postProposalStale(suggestion, actionContext(f.editor, f.client).current())).toBe(
            true,
        )
        f.setAuthorized(false)
        await expect(f.proofreading()).rejects.toMatchObject({ code: 'SITE_ADMIN_AUTH_REQUIRED' })
        await expect(
            f.client.publishEntry(id, {
                expectedVersion: f.editor.version.value!,
                draft: f.editor.draft.serialize(),
            }),
        ).rejects.toMatchObject({ code: 'SITE_ADMIN_AUTH_REQUIRED' })
        expect(run).toHaveBeenCalledTimes(1)
    } finally {
        f.close()
    }
})

test('automatic updates keep the published URL and schedules pin candidates across draft edits', async () => {
    const run = vi.fn(async () => completion({ excerpt: 'A new short introduction.' }))
    const f = await fixture(run)
    const scope = effectScope()
    try {
        let legacy = await f.admin.createEntry('posts', {
            slug: 'confirmed-url',
            data: { title: 'Existing title', content: '# Existing body', tags: [] },
        })
        legacy = await f.admin.publishEntry(legacy.id, { expectedVersion: legacy.version })
        const descriptor = (await f.client.models()).models.posts!
        const editor = scope.run(() =>
            useSiteAdminForm({ descriptor, modelName: 'posts', client: f.client, entry: legacy }),
        )!
        editor.form.setFieldValue('publication', { slug: 'auto', excerpt: 'auto' })
        editor.metadata.slug.value = 'unconfirmed-draft-url'
        editor.form.setFieldValue('content', '# Scheduled body')
        const candidate = await f.publication(editor)
        expect(candidate.slug).toBe('confirmed-url')
        applyPublication(editor, candidate)
        expect(await editor.schedule('2026-10-09T01:00:00Z')).toBeDefined()
        let scheduled = await f.admin.getEntry(legacy.id)
        const pinned = scheduled.scheduledRevisionId
        expect(pinned).toBe(scheduled.currentRevisionId)
        expect((await f.admin.getPublicEntry('posts', 'confirmed-url'))?.data.content).toBe(
            '# Existing body',
        )
        editor.form.setFieldValue('content', '# Later draft body')
        await editor.form.handleSubmit()
        scheduled = await f.admin.getEntry(legacy.id)
        expect(scheduled.scheduledRevisionId).toBe(pinned)
        expect(scheduled.currentRevisionId).not.toBe(pinned)
        f.setNow(new Date('2026-10-09T02:00:00Z'))
        expect((await f.admin.publishDue()).published).toEqual([legacy.id])
        expect((await f.admin.getPublicEntry('posts', 'confirmed-url'))?.data.content).toBe(
            '# Scheduled body',
        )
        expect(Object.keys(f.requests[0]!.body.text.format.schema.properties)).toEqual(['excerpt'])
        let current = await f.admin.getEntry(legacy.id)
        current = await f.admin.unpublishEntry(legacy.id, { expectedVersion: current.version })
        const republishing = scope.run(() =>
            useSiteAdminForm({ descriptor, modelName: 'posts', client: f.client, entry: current }),
        )!
        const republishCandidate = await f.publication(republishing)
        expect(republishCandidate.slug).toBe('confirmed-url')
        applyPublication(republishing, republishCandidate)
        expect(await republishing.publish()).toBeDefined()
        expect((await f.admin.getPublicEntry('posts', 'confirmed-url'))?.data.content).toBe(
            '# Later draft body',
        )
        expect(run).toHaveBeenCalledTimes(2)
    } finally {
        scope.stop()
        f.close()
    }
})

test('list unpublish preserves a legacy public URL and its current draft before republishing', async () => {
    const run = vi.fn(async () => completion({ excerpt: 'An introduction after republishing.' }))
    const f = await fixture(run)
    const scope = effectScope()
    try {
        let legacy = await f.admin.createEntry('posts', {
            slug: 'former-public-url',
            data: { title: 'Former title', content: '# Published content', tags: [] },
        })
        legacy = await f.admin.publishEntry(legacy.id, { expectedVersion: legacy.version })
        legacy = await f.admin.updateEntry(legacy.id, {
            expectedVersion: legacy.version,
            slug: 'unpublished-draft-url',
            data: { title: 'Changed title', content: '# Later draft', tags: ['draft'] },
        })
        const descriptor = (await f.client.models()).models.posts!
        const unpublished = await unpublishPost(f.client, descriptor, legacy)
        expect(unpublished.version).toBe(legacy.version + 2)
        const current = await f.admin.getEntry(legacy.id)
        expect(current.publishedRevisionId).toBeNull()
        expect(current.slug).toBe('unpublished-draft-url')
        expect(current.data).toMatchObject({
            title: 'Changed title',
            content: '# Later draft',
            tags: ['draft'],
            publication: { slug: 'manual', excerpt: 'manual', publishedSlug: 'former-public-url' },
        })
        expect(await f.admin.getPublicEntry('posts', 'former-public-url')).toBeNull()
        const editor = scope.run(() =>
            useSiteAdminForm({ descriptor, modelName: 'posts', client: f.client, entry: current }),
        )!
        editor.form.setFieldValue('publication', {
            ...(current.data.publication as Record<string, unknown>),
            slug: 'auto',
            excerpt: 'auto',
        })
        const candidate = await f.publication(editor)
        expect(candidate.slug).toBe('former-public-url')
        applyPublication(editor, candidate)
        expect(await editor.publish()).toBeDefined()
        expect((await f.admin.getPublicEntry('posts', 'former-public-url'))?.data.content).toBe(
            '# Later draft',
        )
        expect(run).toHaveBeenCalledTimes(1)
        expect(f.model).not.toHaveBeenCalled()
        expect(Object.keys(f.requests[0]!.body.text.format.schema.properties)).toEqual(['excerpt'])
    } finally {
        scope.stop()
        f.close()
    }
})

test.each(['missing revision', 'stale version', 'unauthorized'])(
    'list unpublish fails closed on %s without losing the published pointer or current input',
    async (failure) => {
        const run = vi.fn(() => {
            throw new Error('Unexpected inference')
        })
        const f = await fixture(run)
        try {
            let legacy = await f.admin.createEntry('posts', {
                slug: 'former-public-url',
                data: { title: 'Former title', content: '# Published content', tags: [] },
            })
            legacy = await f.admin.publishEntry(legacy.id, { expectedVersion: legacy.version })
            const descriptor = (await f.client.models()).models.posts!
            let input = legacy
            if (failure === 'missing revision')
                input = { ...legacy, publishedRevisionId: 'missing' }
            if (failure === 'stale version') {
                await f.admin.updateEntry(legacy.id, {
                    expectedVersion: legacy.version,
                    data: { ...legacy.data, content: '# Concurrent draft' },
                })
            }
            if (failure === 'unauthorized') f.setAuthorized(false)
            const before = await f.admin.getEntry(legacy.id)
            await expect(unpublishPost(f.client, descriptor, input)).rejects.toMatchObject({
                code:
                    failure === 'unauthorized' ? 'SITE_ADMIN_AUTH_REQUIRED' : 'SITE_ADMIN_CONFLICT',
            })
            expect(await f.admin.getEntry(legacy.id)).toEqual(before)
            expect(f.calls.some((call) => call.path.endsWith('/unpublish'))).toBe(false)
            expect(run).not.toHaveBeenCalled()
            expect(f.model).not.toHaveBeenCalled()
        } finally {
            f.close()
        }
    },
)

test('a concurrent edit between URL preservation and unpublish stays published', async () => {
    const run = vi.fn(() => {
        throw new Error('Unexpected inference')
    })
    const f = await fixture(run)
    try {
        let legacy = await f.admin.createEntry('posts', {
            slug: 'former-public-url',
            data: { title: 'Former title', content: '# Published content', tags: [] },
        })
        legacy = await f.admin.publishEntry(legacy.id, { expectedVersion: legacy.version })
        const descriptor = (await f.client.models()).models.posts!
        await expect(
            unpublishPost(
                {
                    ...f.client,
                    unpublishEntry: async (id, input) => {
                        const saved = await f.admin.getEntry(id)
                        await f.admin.updateEntry(id, {
                            expectedVersion: saved.version,
                            data: { ...saved.data, content: '# Concurrent draft' },
                        })
                        return f.client.unpublishEntry(id, input)
                    },
                },
                descriptor,
                legacy,
            ),
        ).rejects.toMatchObject({ code: 'SITE_ADMIN_CONFLICT' })
        const current = await f.admin.getEntry(legacy.id)
        expect(current.publishedRevisionId).toBe(legacy.publishedRevisionId)
        expect(current.data.content).toBe('# Concurrent draft')
        expect(current.data.publication).toMatchObject({ publishedSlug: 'former-public-url' })
        expect((await f.admin.getPublicEntry('posts', 'former-public-url'))?.data.content).toBe(
            '# Published content',
        )
        expect(run).not.toHaveBeenCalled()
    } finally {
        f.close()
    }
})

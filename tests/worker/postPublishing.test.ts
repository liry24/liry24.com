import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdminManagementClient } from '@liria24/site-admin/client'
import { useSiteAdminForm } from '@liria24/site-admin/form'
import { configureSiteAdminRuntime } from '@liria24/site-admin/nuxt/server'
import { createSiteAdmin, handleManagementRequest } from '@liria24/site-admin/server'
import type { RequestEvent } from 'nuxt/server'
import { expect, test, vi } from 'vitest'
import { effectScope } from 'vue'
import type { createWorkersAI } from 'workers-ai-provider'

import { unpublishPost } from '../../app/utils/postUnpublish'
import { openDevelopmentDB } from '../../server/database/development'
import * as schema from '../../server/database/schema'
import { getWorkersAIModel } from '../../server/utils/workersAI'
import config from '../../site-admin.config'

const completion = (output: Record<string, string>) =>
    Response.json({
        id: 'synthetic',
        object: 'chat.completion',
        created: 0,
        model: 'gpt-6-luna',
        choices: [
            {
                index: 0,
                message: { role: 'assistant', content: JSON.stringify(output) },
                finish_reason: 'stop',
            },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
const initial = {
    title: 'Saved title',
    content: '# Saved body',
    tags: [],
    publication: { slug: 'auto', excerpt: 'auto' },
}
async function fixture(run: ReturnType<typeof vi.fn>) {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const scope = effectScope()
    const calls: { path: string; body?: Record<string, unknown> }[] = []
    let authorized = true
    let now = new Date('2026-10-09T00:00:00Z')
    const model = vi.fn(() =>
        getWorkersAIModel({
            platformContext: {
                env: {
                    AI: {
                        run,
                        gateway: () => {
                            throw new Error('Unexpected external Gateway transport')
                        },
                    } as unknown as Parameters<typeof createWorkersAI>[0]['binding'],
                },
            },
        }),
    )
    const admin = createSiteAdmin<RequestEvent>({
        config: { ...config, ai: { ...config.ai, model } },
        database: drizzleAdapter(local.database, { schema }),
        authorize: () => (authorized ? { id: 'synthetic', roles: ['admin'] } : null),
        aiEnabled: true,
        now: () => now,
    })
    configureSiteAdminRuntime({
        managementBase: '/api/site-admin',
        publicBase: '/api/site-content',
        getSiteAdmin: () => admin,
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
        model,
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

test('native app action publishes the unsaved candidate atomically and deduplicates publication', async () => {
    const run = vi.fn(async () =>
        completion({ slug: 'unsaved-title', excerpt: 'A short introduction in my voice.' }),
    )
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        expect(f.editor.serverError.value).toBeNull()
        expect(f.editor.metadata.slug.value).toBe('')
        expect(f.model).not.toHaveBeenCalled()
        const id = f.editor.entryId.value!
        const base = await f.admin.getEntry(id)
        expect(base.locale).toBe('')
        f.editor.form.setFieldValue('title', 'Unsaved title')
        f.editor.form.setFieldValue('content', '# Unsaved body')
        await f.editor.ai.run('publication', { generateSlug: true, generateExcerpt: true })
        expect(f.editor.ai.error.value).toBeNull()
        expect(f.editor.form.state.values.content).toBe('# Unsaved body')
        expect((await f.admin.getEntry(id)).data.content).toBe('# Saved body')
        expect(JSON.stringify(run.mock.calls[0])).toContain('Unsaved title')
        expect(f.editor.ai.apply({ fields: ['excerpt'], slug: true })).toBe(true)
        f.editor.form.setFieldValue('publication', {
            slug: 'auto',
            excerpt: 'auto',
            publishedSlug: 'unsaved-title',
        })
        const before = f.calls.length
        const [first, second] = await Promise.all([f.editor.publish(), f.editor.publish()])
        expect(first).toEqual(second)
        expect(first).toBeDefined()
        expect(f.calls.slice(before).map((call) => call.path)).toEqual([
            `/api/site-admin/entries/${id}/publish`,
        ])
        expect(f.calls.at(-1)?.body).toMatchObject({
            expectedVersion: base.version,
            draft: {
                slug: 'unsaved-title',
                data: {
                    content: '# Unsaved body',
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
    } finally {
        f.close()
    }
})

test('AI failure keeps input and draft saving still works, while explicit manual publication bypasses AI', async () => {
    const run = vi.fn(async () => {
        throw new Error('Synthetic HTTP 402 insufficient balance')
    })
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        const id = f.editor.entryId.value!
        f.editor.form.setFieldValue('content', '# Input that must survive')
        await f.editor.ai.run('publication', { generateSlug: true, generateExcerpt: true })
        expect(f.editor.ai.error.value).toBeTruthy()
        expect(f.editor.form.state.values.content).toBe('# Input that must survive')
        expect(await f.editor.publish()).toBeUndefined()
        expect((await f.admin.getEntry(id)).publishedRevisionId).toBeNull()
        await f.editor.form.handleSubmit()
        expect(f.editor.serverError.value).toBeNull()
        expect((await f.admin.getEntry(id)).data.content).toBe('# Input that must survive')
        f.editor.form.setFieldValue('publication', {
            slug: 'manual',
            excerpt: 'manual',
            publishedSlug: 'manual-url',
        })
        f.editor.form.setFieldValue('excerpt', 'My own introduction.')
        f.editor.metadata.slug.value = 'manual-url'
        f.editor.ai.discard()
        expect(await f.editor.publish()).toBeDefined()
        expect((await f.admin.getPublicEntry('posts', 'manual-url'))?.data.excerpt).toBe(
            'My own introduction.',
        )
        expect(run).toHaveBeenCalledTimes(1)
        expect(f.model).toHaveBeenCalledTimes(1)
    } finally {
        f.close()
    }
})

test('changed snapshots and concurrent author edits reject AI publication without losing local input', async () => {
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
        const pending = f.editor.ai.run('publication', {
            generateSlug: true,
            generateExcerpt: true,
        })
        await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
        f.editor.form.setFieldValue('content', '# Local edit during AI')
        release(completion({ slug: 'stale-output', excerpt: 'Stale introduction.' }))
        await pending
        expect(f.editor.ai.stale.value).toBe(true)
        expect(f.editor.ai.apply({ fields: ['excerpt'], slug: true })).toBe(false)
        expect(await f.editor.publish()).toBeUndefined()
        f.editor.ai.discard()
        const second = f.editor.ai.run('publication', { generateSlug: true, generateExcerpt: true })
        await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
        const current = await f.admin.getEntry(id)
        await f.admin.updateEntry(id, {
            expectedVersion: current.version,
            data: { ...current.data, content: '# Other author' },
        })
        release(completion({ slug: 'concurrent-output', excerpt: 'Concurrent introduction.' }))
        await second
        expect(f.editor.ai.error.value).toBeTruthy()
        expect(f.editor.form.state.values.content).toBe('# Local edit during AI')
        expect((await f.admin.getEntry(id)).publishedRevisionId).toBeNull()
    } finally {
        f.close()
    }
})

test('proofreading is review-only, preserves manual metadata, and unauthorized actions fail closed', async () => {
    const run = vi.fn(async () => completion({ content: '# Proofread body' }))
    const f = await fixture(run)
    try {
        await f.editor.form.handleSubmit()
        const id = f.editor.entryId.value!
        f.editor.metadata.slug.value = 'manual-url'
        f.editor.form.setFieldValue('excerpt', 'My own introduction.')
        await f.editor.ai.run('proofread')
        expect(f.editor.ai.error.value).toBeNull()
        expect(f.editor.form.state.values.content).toBe('# Saved body')
        expect(f.editor.ai.apply({ fields: ['content'], slug: false })).toBe(true)
        expect(f.editor.form.state.values.content).toBe('# Proofread body')
        expect(f.editor.metadata.slug.value).toBe('manual-url')
        expect(f.editor.form.state.values.excerpt).toBe('My own introduction.')
        expect((await f.admin.getEntry(id)).data.content).toBe('# Saved body')
        f.setAuthorized(false)
        await expect(
            f.client.runAIAction(id, 'proofread', {
                expectedVersion: f.editor.version.value,
                draft: f.editor.draft.serialize(),
            }),
        ).rejects.toMatchObject({ code: 'SITE_ADMIN_AUTH_REQUIRED' })
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

test('automatic updates keep the published URL and schedules pin their candidate across later draft edits', async () => {
    const run = vi.fn(async () => completion({ excerpt: 'A new short introduction.' }))
    const f = await fixture(run)
    try {
        let legacy = await f.admin.createEntry('posts', {
            slug: 'confirmed-url',
            data: { title: 'Existing title', content: '# Existing body', tags: [] },
        })
        legacy = await f.admin.publishEntry(legacy.id, { expectedVersion: legacy.version })
        const descriptor = (await f.client.models()).models.posts!
        const scope = effectScope()
        try {
            const editor = scope.run(() =>
                useSiteAdminForm({
                    descriptor,
                    modelName: 'posts',
                    client: f.client,
                    entry: legacy,
                }),
            )!
            editor.form.setFieldValue('publication', { slug: 'auto', excerpt: 'auto' })
            editor.metadata.slug.value = 'unconfirmed-draft-url'
            editor.form.setFieldValue('content', '# Scheduled body')
            await editor.ai.run('publication', { generateSlug: true, generateExcerpt: true })
            expect(editor.ai.error.value).toBeNull()
            expect(editor.ai.proposal.value?.slug).toBe('confirmed-url')
            expect(editor.ai.apply({ fields: ['excerpt'], slug: true })).toBe(true)
            editor.form.setFieldValue('publication', {
                slug: 'auto',
                excerpt: 'auto',
                publishedSlug: 'confirmed-url',
            })
            const at = '2026-10-09T01:00:00Z'
            expect(await editor.schedule(at)).toBeDefined()
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
            expect(run).toHaveBeenCalledTimes(1)
            const body = run.mock.calls[0]![1] as {
                response_format: {
                    json_schema: { schema: { properties: Record<string, unknown> } }
                }
            }
            expect(Object.keys(body.response_format.json_schema.schema.properties)).toEqual([
                'excerpt',
            ])
            let current = await f.admin.getEntry(legacy.id)
            current = await f.admin.unpublishEntry(legacy.id, { expectedVersion: current.version })
            const republishing = scope.run(() =>
                useSiteAdminForm({
                    descriptor,
                    modelName: 'posts',
                    client: f.client,
                    entry: current,
                }),
            )!
            await republishing.ai.run('publication', { generateSlug: true, generateExcerpt: true })
            expect(republishing.ai.error.value).toBeNull()
            expect(republishing.ai.proposal.value?.slug).toBe('confirmed-url')
            expect(republishing.ai.apply({ fields: ['excerpt'], slug: true })).toBe(true)
            expect(await republishing.publish()).toBeDefined()
            expect((await f.admin.getPublicEntry('posts', 'confirmed-url'))?.data.content).toBe(
                '# Later draft body',
            )
            expect(run).toHaveBeenCalledTimes(2)
        } finally {
            scope.stop()
        }
    } finally {
        f.close()
    }
})

test('list unpublish preserves a migrated post public URL before its first new-editor publication', async () => {
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
        expect(legacy.data.publication).toBeUndefined()
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
        expect(f.model).not.toHaveBeenCalled()
        const editor = scope.run(() =>
            useSiteAdminForm({ descriptor, modelName: 'posts', client: f.client, entry: current }),
        )!
        editor.form.setFieldValue('publication', {
            ...(current.data.publication as Record<string, unknown>),
            slug: 'auto',
            excerpt: 'auto',
        })
        await editor.ai.run('publication', { generateSlug: true, generateExcerpt: true })
        expect(editor.ai.error.value).toBeNull()
        expect(editor.ai.proposal.value?.slug).toBe('former-public-url')
        expect(editor.ai.apply({ fields: ['excerpt'], slug: true })).toBe(true)
        expect(await editor.publish()).toBeDefined()
        expect((await f.admin.getPublicEntry('posts', 'former-public-url'))?.data.content).toBe(
            '# Later draft',
        )
        expect(run).toHaveBeenCalledTimes(1)
        const body = run.mock.calls[0]![1] as {
            response_format: { json_schema: { schema: { properties: Record<string, unknown> } } }
        }
        expect(Object.keys(body.response_format.json_schema.schema.properties)).toEqual(['excerpt'])
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

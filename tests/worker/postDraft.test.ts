import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdminManagementClient } from '@liria24/site-admin/internal/client'
import { createSiteAdmin, handleManagementRequest } from '@liria24/site-admin/internal/server'
import { expect, test, vi } from 'vitest'
import { effectScope } from 'vue'

import { openDevelopmentDB } from '../../server/database/development'
import * as schema from '../../server/database/schema'
import { postPublicationSettings } from '../../shared/utils/postEditorial'
import config from '../../site-admin.config'
import { createModelForm } from '../helpers/model'

test('draft form persists automatic choices without AI or a public route and keeps conflicts', async () => {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const scope = effectScope()
    const ai = vi.fn(() => {
        throw new Error('AI has no balance')
    })
    const paths: string[] = []
    const admin = createSiteAdmin({
        locales: { defaultLocale: 'ja', supported: ['ja'] },
        config: { ...config, ai: { ...config.ai, model: ai } },
        database: drizzleAdapter(local.database, { schema }),
        authorize: () => ({ id: 'synthetic-post-admin', roles: ['admin'] }),
    })
    const client = createSiteAdminManagementClient({
        origin: 'http://synthetic.invalid',
        fetch: async (input, init) => {
            const request = new Request(String(input), init)
            paths.push(new URL(request.url).pathname)
            return handleManagementRequest(admin, request)
        },
    })
    try {
        const descriptor = (await client.models()).models.posts!
        let controller = scope.run(() =>
            createModelForm({
                descriptor,
                modelName: 'posts',
                client,
                defaultValues: {
                    title: 'Synthetic post',
                    content: '# Unsaved body',
                    tags: [],
                    publication: { slug: 'auto' },
                },
            }),
        )!
        await controller.form.handleSubmit()
        expect(controller.resource.error.value).toBeUndefined()
        const id = controller.draft.snapshot().entryId!
        const first = await admin.getEntry(id)
        expect(first.data).toMatchObject({
            content: '# Unsaved body',
            publication: { slug: 'auto' },
        })
        expect(first.publishedRevisionId).toBeNull()
        expect(await admin.getPublicEntry('posts', first.id)).toBeNull()
        expect(paths.some((path) => path.includes('/ai/'))).toBe(false)
        expect(ai).not.toHaveBeenCalled()

        controller = scope.run(() =>
            createModelForm({
                descriptor,
                modelName: 'posts',
                client,
                entry: first,
            }),
        )!
        controller.form.setFieldValue('content', '# Changed body')
        controller.form.setFieldValue('publication', { slug: 'manual' })
        await controller.form.handleSubmit()
        const saved = await admin.getEntry(id)
        expect(saved.data).toMatchObject({
            content: '# Changed body',
            publication: { slug: 'manual' },
        })
        controller.form.setFieldValue('content', '# Local text that must survive')
        await admin.updateEntry(id, {
            expectedVersion: saved.version,
            data: { ...saved.data, content: '# Another author edit' },
        })
        await controller.form.handleSubmit()
        expect(controller.resource.error.value?.data?.code).toBe('SITE_ADMIN_CONFLICT')
        expect(controller.form.state.values.content).toBe('# Local text that must survive')
        expect(ai).not.toHaveBeenCalled()
    } finally {
        scope.stop()
        local.close()
    }
})

test('legacy drafts and published revisions retain metadata when no selection was recorded', async () => {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const scope = effectScope()
    const ai = vi.fn(() => {
        throw new Error('AI has no balance')
    })
    const admin = createSiteAdmin({
        locales: { defaultLocale: 'ja', supported: ['ja'] },
        config: { ...config, ai: { ...config.ai, model: ai } },
        database: drizzleAdapter(local.database, { schema }),
        authorize: () => ({ id: 'synthetic-legacy-admin', roles: ['admin'] }),
    })
    const client = createSiteAdminManagementClient({
        origin: 'http://synthetic.invalid',
        fetch: (input, init) => handleManagementRequest(admin, new Request(String(input), init)),
    })
    try {
        const descriptor = (await client.models()).models.posts!
        for (const published of [false, true]) {
            let entry = await admin.createEntry('posts', {
                data: {
                    title: 'Existing post',
                    content: '# Existing content',
                    tags: [],
                    slug: published ? 'existing-public-url' : 'existing-draft-slug',
                },
            })
            if (published)
                entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
            const publicRevision = entry.publishedRevisionId
            const loaded = await client.getEntry(entry.id)
            expect(postPublicationSettings(loaded.data)).toEqual({ slug: 'manual' })
            const controller = scope.run(() =>
                createModelForm({
                    descriptor,
                    modelName: 'posts',
                    client,
                    entry: loaded,
                }),
            )!
            expect(controller.form.state.values.slug).toBe(entry.data.slug)
            controller.form.setFieldValue('title', 'Edited title')
            await controller.form.handleSubmit()
            const saved = await admin.getEntry(entry.id)
            expect(saved.data.slug).toBe(entry.data.slug)
            expect(saved.publishedRevisionId).toBe(publicRevision)
            if (published)
                expect((await admin.getPublicEntry('posts', entry.id))?.data.title).toBe(
                    'Existing post',
                )
        }
        expect(ai).not.toHaveBeenCalled()
    } finally {
        scope.stop()
        local.close()
    }
})

test('an implicit slug on a directly published model retains the non-AI title fallback', async () => {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const scope = effectScope()
    const model = vi.fn(() => {
        throw new Error('AI must not resolve during a save')
    })
    const admin = createSiteAdmin({
        locales: { defaultLocale: 'ja', supported: ['ja'] },
        config: {
            ...config,
            models: { ...config.models, works: { ...config.models.works, publishing: false } },
            ai: { ...config.ai, model },
        },
        database: drizzleAdapter(local.database, { schema }),
        authorize: () => ({ id: 'synthetic-work-admin', roles: ['admin'] }),
    })
    const client = createSiteAdminManagementClient({
        origin: 'http://synthetic.invalid',
        fetch: (input, init) => handleManagementRequest(admin, new Request(String(input), init)),
    })
    try {
        const descriptor = (await client.models()).models.works!
        const editor = scope.run(() =>
            createModelForm({
                descriptor,
                modelName: 'works',
                client,
                defaultValues: { title: 'Synthetic work', style: 'small' },
            }),
        )!
        await editor.form.handleSubmit()
        expect(editor.resource.error.value).toBeUndefined()
        const entry = await admin.getEntry(editor.draft.snapshot().entryId!)
        expect(entry.data.slug).toBe('synthetic-work')
        expect(model).not.toHaveBeenCalled()
    } finally {
        scope.stop()
        local.close()
    }
})

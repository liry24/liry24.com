import { object, select, textarea } from '@liria24/site-admin'
import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdminManagementClient } from '@liria24/site-admin/client'
import { useSiteAdminForm } from '@liria24/site-admin/form'
import { createSiteAdmin, handleManagementRequest } from '@liria24/site-admin/server'
import { expect, test, vi } from 'vitest'
import { effectScope } from 'vue'

import { preparePostPublication } from '../../app/utils/postEditorialFlow'
import { openDevelopmentDB } from '../../server/database/development'
import * as schema from '../../server/database/schema'
import { postPublicationSettings } from '../../shared/utils/postEditorial'
import config from '../../site-admin.config'

// Synthetic in-memory legacy storage only. All management HTTP requests are
// dispatched locally; neither the real app database nor an AI provider is used.
async function fixture() {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const scope = effectScope()
    const database = drizzleAdapter(local.database, { schema })
    const legacy = createSiteAdmin({
        database,
        config: {
            ...config,
            models: {
                ...config.models,
                posts: {
                    ...config.models.posts,
                    displayFields: { ...config.models.posts.displayFields, description: 'excerpt' },
                    fields: {
                        ...config.models.posts.fields,
                        excerpt: textarea(),
                        publication: object({
                            ...config.models.posts.fields.publication.fields,
                            excerpt: select(['auto', 'manual']),
                        }),
                    },
                },
            },
        },
    })
    let entry = await legacy.createEntry('posts', {
        slug: 'synthetic-legacy-management-url',
        data: {
            title: 'Synthetic legacy post',
            content: 'Legacy introduction.\n\n<!-- more -->\n\nLegacy full body.',
            excerpt: 'Retired legacy description.',
            tags: ['legacy'],
            publication: { slug: 'auto', excerpt: 'auto' },
        },
    })
    entry = await legacy.publishEntry(entry.id, { expectedVersion: entry.version })
    const retained = () =>
        local.database.$client
            .prepare(
                'SELECT r.id, c.* FROM site_admin_revisions r JOIN site_admin_content_posts c ON c.revision_id = r.id WHERE r.entry_id = ? ORDER BY r.id',
            )
            .all(entry.id)
    const history = retained()
    const admin = createSiteAdmin({
        config,
        database,
        authorize: () => ({ id: 'synthetic-legacy-management-admin', roles: ['admin'] }),
    })
    const requests: { path: string; method: string; status: number; response: unknown }[] = []
    const client = createSiteAdminManagementClient({
        origin: 'http://synthetic.invalid',
        fetch: async (input, init) => {
            const request = new Request(String(input), init)
            const response = await handleManagementRequest(admin, request)
            requests.push({
                path: new URL(request.url).pathname,
                method: request.method,
                status: response.status,
                response: await response.clone().json(),
            })
            return response
        },
    })
    const descriptor = (await client.models()).models.posts!
    const loaded = await client.getEntry(entry.id)
    const editor = scope.run(() =>
        useSiteAdminForm({
            descriptor,
            modelName: 'posts',
            client,
            entry: loaded,
            presentation: true,
        }),
    )!
    return {
        local,
        scope,
        admin,
        client,
        entry,
        loaded,
        editor,
        requests,
        assertHistory() {
            expect(
                retained().filter((row) => history.some((original) => original.id === row.id)),
            ).toEqual(history)
        },
        close() {
            try {
                expect(
                    retained().filter((row) => history.some((original) => original.id === row.id)),
                ).toEqual(history)
            } finally {
                scope.stop()
                local.close()
            }
        },
    }
}

test('standard native edit form saves a legacy nested excerpt choice as a new draft', async () => {
    const f = await fixture()
    try {
        f.editor.form.setFieldValue('title', 'Edited synthetic legacy title')
        await f.editor.form.handleSubmit()
        f.assertHistory()
        expect(f.editor.form.state.values.title).toBe('Edited synthetic legacy title')
        if (f.editor.serverError.value)
            expect((await f.client.getEntry(f.entry.id)).version).toBe(f.loaded.version)
        expect(
            f.editor.serverError.value,
            JSON.stringify(f.requests.findLast((request) => request.method === 'PATCH')),
        ).toBeNull()
        const saved = await f.client.getEntry(f.entry.id)
        expect(saved.data.title).toBe('Edited synthetic legacy title')
        expect(saved.slug).toBe(f.entry.slug)
        expect(saved.publishedRevisionId).toBe(f.entry.publishedRevisionId)
    } finally {
        f.close()
    }
})

test('app publication flow can publish a legacy edit without AI and retains history', async () => {
    const f = await fixture()
    const ai = vi.fn(() => {
        throw new Error('Confirmed legacy URL must not invoke AI')
    })
    try {
        f.editor.form.setFieldValue('title', 'Published synthetic legacy edit')
        const candidate = await preparePostPublication(
            {
                management: f.client,
                current: () => ({
                    entryId: f.editor.entryId.value,
                    version: f.editor.version.value,
                    draft: f.editor.draft.serialize(),
                }),
            },
            ai,
        )
        // Match PostEditor.publish: it records the confirmed slug and the
        // active publication settings immediately before the native mutation.
        f.editor.metadata.slug.value = candidate.slug
        f.editor.form.setFieldValue('publication', {
            ...postPublicationSettings(f.editor.form.state.values),
            publishedSlug: candidate.slug,
        })
        expect(await f.editor.publish(), JSON.stringify(f.requests.at(-1))).toBeDefined()
        expect(f.editor.serverError.value).toBeNull()
        expect(ai).not.toHaveBeenCalled()
        f.assertHistory()
        const saved = await f.client.getEntry(f.entry.id)
        expect(saved.slug).toBe(f.entry.slug)
        expect(saved.currentRevisionId).toBe(saved.publishedRevisionId)
        expect((await f.admin.getPublicEntry('posts', saved.slug))?.data.title).toBe(
            'Published synthetic legacy edit',
        )
    } finally {
        f.close()
    }
})

test('management revision history can restore a legacy excerpt revision as a new current draft', async () => {
    const f = await fixture()
    try {
        const revisions = await f.client.listRevisions(f.entry.id)
        const original = revisions.find((revision) => revision.id === f.entry.publishedRevisionId)!
        expect(original).toBeDefined()
        const restored = await f.client
            .restoreRevision(f.entry.id, original.id, {
                expectedVersion: f.loaded.version,
            })
            .catch(async (error) => {
                console.error('Synthetic legacy restore failure', JSON.stringify(f.requests.at(-1)))
                const unchanged = await f.client.getEntry(f.entry.id)
                expect(unchanged.version).toBe(f.loaded.version)
                expect(unchanged.currentRevisionId).toBe(f.loaded.currentRevisionId)
                expect(unchanged.publishedRevisionId).toBe(f.loaded.publishedRevisionId)
                throw error
            })
        f.assertHistory()
        const current = await f.client.getEntry(f.entry.id)
        expect(current.currentRevisionId).toBe(restored.currentRevisionId)
        expect(current.currentRevisionId).not.toBe(original.id)
        expect(current.publishedRevisionId).toBe(f.entry.publishedRevisionId)
        expect(current.slug).toBe(f.entry.slug)
        expect(current.data.content).toBe(f.loaded.data.content)
    } finally {
        f.close()
    }
})

test('new management input still rejects retired and unrelated nested keys', async () => {
    const f = await fixture()
    try {
        for (const unknown of ['excerpt', 'unrelated'])
            await expect(
                f.client.createEntry('posts', {
                    slug: 'synthetic-invalid-new-input',
                    data: {
                        title: 'Invalid new input',
                        content: 'Synthetic body.',
                        tags: [],
                        publication: { slug: 'manual', [unknown]: 'auto' },
                    },
                }),
            ).rejects.toMatchObject({ code: 'SITE_ADMIN_INVALID_INPUT' })
        f.assertHistory()
    } finally {
        f.close()
    }
})

test('management entry, list and revision DTOs project retired keys without changing storage', async () => {
    const f = await fixture()
    try {
        const entries = await f.client.listEntries('posts')
        const revisions = await f.client.listRevisions(f.entry.id)
        const listed = entries.items.find((entry) => entry.id === f.entry.id)!
        expect(listed).toBeDefined()
        expect(revisions.length).toBeGreaterThan(0)
        for (const record of [f.loaded, listed, ...revisions]) {
            expect(record.data).not.toHaveProperty('excerpt')
            expect(record.data.publication).toEqual({ slug: 'auto' })
            expect(record.data.content).toBe(f.entry.data.content)
        }
        f.assertHistory()
    } finally {
        f.close()
    }
})

test('native form initialization and refresh project a raw legacy revision without changing it', async () => {
    const f = await fixture()
    try {
        const legacyData = structuredClone(f.entry.data)
        expect(legacyData.publication).toHaveProperty('excerpt', 'auto')
        const editor = f.scope.run(() =>
            useSiteAdminForm({
                descriptor: f.editor.descriptor.value,
                modelName: 'posts',
                client: f.client,
                entry: f.entry,
                presentation: true,
                loadEntry: async () => f.entry,
            }),
        )!
        for (const refresh of [false, true]) {
            if (refresh) await editor.refresh()
            expect(editor.loadError.value).toBeNull()
            expect(editor.form.state.values).not.toHaveProperty('excerpt')
            expect(editor.form.state.values.publication).toEqual({ slug: 'auto' })
            expect(editor.form.state.values.content).toBe(legacyData.content)
            expect(editor.dirty.value).toBe(false)
        }
        expect(f.entry.data).toEqual(legacyData)
        f.assertHistory()
    } finally {
        f.close()
    }
})

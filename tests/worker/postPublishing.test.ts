import { createSiteAdminManagementClient } from '@liria24/site-admin/internal/client'
import { createSiteAdmin, handleManagementRequest } from '@liria24/site-admin/internal/server'
import { afterEach, expect, test, vi } from 'vitest'
import { effectScope } from 'vue'

import { preparePostProofreading } from '../../app/utils/postEditorialFlow'
import { prepareEntry } from '../../app/utils/prepareEntry'
import config from '../../site-admin.config'
import { openTestDatabase } from '../helpers/database'
import { createModelForm } from '../helpers/model'

const cleanup: (() => void)[] = []
afterEach(() => {
    for (const close of cleanup.splice(0)) close()
})
const defaults = {
    title: 'Example Content',
    content: '# Original',
    tags: [],
    publication: { slug: 'auto' },
}
async function fixture(
    modelName = 'posts',
    generate = vi.fn(async () => ({ slug: 'generated-post' })),
) {
    const local = openTestDatabase()
    const scope = effectScope()
    cleanup.push(() => {
        scope.stop()
        local.close()
    })
    let authorized = true
    const writes: string[] = []
    const admin = createSiteAdmin({
        locales: { defaultLocale: 'ja', supported: ['ja'] },
        config,
        database: local.database,
        authorize: () => (authorized ? { id: 'synthetic', roles: ['admin'] } : null),
    })
    const client = createSiteAdminManagementClient({
        origin: 'http://synthetic.invalid',
        fetch: (input, init) => {
            if (init?.method !== 'GET') writes.push(String(input))
            return handleManagementRequest(admin, new Request(input, init))
        },
    })
    const editor = scope.run(() =>
        createModelForm({
            modelName,
            client,
            descriptor: admin.descriptor.models[modelName]!,
            defaultValues:
                modelName === 'posts' ? defaults : { title: 'Example Content', style: 'small' },
            prepare: (context) => prepareEntry(context, generate),
        }),
    )!
    return {
        admin,
        client,
        editor,
        generate,
        writes,
        unauthorized: () => {
            authorized = false
        },
    }
}
test('first publication saves the draft before AI and submits the candidate once', async () => {
    const { admin, editor, generate, writes } = await fixture()
    const [result, duplicate] = await Promise.all([editor.publish(), editor.publish()])
    expect(result).toEqual(duplicate)
    expect(editor.resource.error.value).toBeUndefined()
    expect(generate).toHaveBeenCalledOnce()
    expect(writes).toHaveLength(2)
    const saved = await admin.getEntry(result!.id)
    expect(saved.data).toMatchObject({
        title: 'Example Content',
        content: '# Original',
        slug: 'generated-post',
        publication: { publishedSlug: 'generated-post' },
    })
    expect(saved.currentRevisionId).toBe(saved.publishedRevisionId)
    expect(editor.form.state.values.slug).toBe('generated-post')
    expect(editor.draft.isDirty.value).toBe(false)
})
test('an AI failure retains the persisted draft and retries its identity', async () => {
    const generate = vi.fn(async () => {
        throw new Error('Synthetic AI failure')
    })
    const { admin, editor, writes } = await fixture('posts', generate)
    expect(await editor.publish()).toBeUndefined()
    const snapshot = editor.draft.snapshot()
    expect(snapshot.entryId).toBeTruthy()
    expect((await admin.getEntry(snapshot.entryId!)).publishedRevisionId).toBeNull()
    expect(editor.form.state.values.content).toBe('# Original')
    generate.mockImplementation(async () => ({ slug: 'retry-url' }))
    await editor.publish()
    expect(await admin.listEntries('posts')).toHaveLength(1)
    expect(writes.filter((url) => /\/entries\/posts$/u.test(url))).toHaveLength(1)
    expect((await admin.getEntry(snapshot.entryId!)).data.slug).toBe('retry-url')
})
test('input changes during generation cannot publish a stale proposal', async () => {
    const started = Promise.withResolvers<void>()
    const generated = Promise.withResolvers<{ slug: string }>()
    const generate = vi.fn(async () => {
        started.resolve()
        return generated.promise
    })
    const { admin, editor, writes } = await fixture('posts', generate)
    const publishing = editor.publish()
    await started.promise
    editor.form.setFieldValue('content', '# Newer input')
    generated.resolve({ slug: 'stale-url' })
    await publishing
    expect(editor.resource.error.value?.data?.code).toBe('SITE_ADMIN_CONFLICT')
    expect(writes).toHaveLength(1)
    expect(editor.form.state.values.content).toBe('# Newer input')
    expect((await admin.getEntry(editor.draft.snapshot().entryId!)).publishedRevisionId).toBeNull()
})
test('draft saves never generate a slug and unauthenticated writes cannot invoke AI', async () => {
    const { editor, generate, unauthorized } = await fixture()
    await editor.form.handleSubmit()
    expect(editor.form.state.values.slug).toBe('')
    expect(generate).not.toHaveBeenCalled()
    unauthorized()
    await editor.publish()
    expect(editor.resource.error.value?.statusCode).toBe(401)
})
test('manual input wins and established URLs survive label changes and unpublishing', async () => {
    const { editor, admin, generate } = await fixture()
    editor.form.setFieldValue('slug', 'manual-first')
    const published = await editor.publish()
    expect(generate).not.toHaveBeenCalled()
    editor.form.setFieldValue('title', 'Changed label')
    await editor.publish()
    expect((await admin.getEntry(published!.id)).data.slug).toBe('manual-first')
    await editor.resource.unpublish()
    editor.form.setFieldValue('slug', '')
    await editor.publish()
    expect(editor.resource.error.value?.data?.code).toBe('SITE_ADMIN_INVALID_INPUT')
    expect(generate).not.toHaveBeenCalled()
})
test('scheduling fixes the candidate once and cron invokes no application AI', async () => {
    const { editor, admin, generate } = await fixture()
    const scheduled = await editor.schedule('2098-01-01T00:00:00Z')
    expect(generate).toHaveBeenCalledOnce()
    editor.form.setFieldValue('title', 'Later draft')
    await editor.form.handleSubmit()
    expect((await admin.publishDue(new Date('2099-01-01T00:00:00Z'))).published).toEqual([
        scheduled!.id,
    ])
    expect(generate).toHaveBeenCalledOnce()
    expect((await admin.getPublicEntry('posts', scheduled!.id))?.data.title).toBe('Example Content')
    expect((await admin.getEntry(scheduled!.id)).data.title).toBe('Later draft')
})
test('other models derive a slug from the label only on publication', async () => {
    const { editor, generate } = await fixture('works')
    await editor.form.handleSubmit()
    expect(editor.form.state.values.slug).toBe('')
    await editor.publish()
    expect(editor.form.state.values.slug).toBe('example-content')
    expect(generate).not.toHaveBeenCalled()
})
test('proofreading rejects a remote edit and preserves local input', async () => {
    const { editor, admin, client } = await fixture()
    await editor.form.handleSubmit()
    const snapshot = editor.draft.snapshot()
    await expect(
        preparePostProofreading(
            {
                management: { entries: { get: (_model, id) => client.getEntry(id) } },
                current: () => editor.draft.snapshot(),
            },
            async () => {
                await admin.updateEntry(snapshot.entryId!, {
                    expectedVersion: snapshot.version!,
                    data: { ...snapshot.draft, content: '# Remote' },
                })
                return { content: '# Suggestion' }
            },
        ),
    ).rejects.toMatchObject({ code: 'SITE_ADMIN_CONFLICT' })
    expect(editor.form.state.values.content).toBe('# Original')
})

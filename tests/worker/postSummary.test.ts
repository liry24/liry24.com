import { drizzleAdapter } from '@liria24/site-admin/adapters/drizzle'
import { createSiteAdminClient } from '@liria24/site-admin/internal/client'
import { createSiteAdmin, handlePublicRequest } from '@liria24/site-admin/internal/server'
import type { MarkdownDocument } from 'comark'
import { expect, test } from 'vitest'

import { openDevelopmentDB } from '../../server/database/development'
import * as schema from '../../server/database/schema'
import config from '../../site-admin.config'

test('native automatic summary stays small without parsing or rewriting content in the app', async () => {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const admin = createSiteAdmin({ config, database: drizzleAdapter(local.database, { schema }) })
    try {
        const content = [
            '# Full article title',
            '![Cover](https://example.invalid/cover.png)',
            '```js\nconsole.log("not an introduction")\n```',
            'An **automatic introduction** with [a link](/posts/reference).',
            'A second paragraph in the author’s voice.',
            'Later body text must stay outside the short introduction. '.repeat(80),
        ].join('\n\n')
        let entry = await admin.createEntry('posts', {
            data: { title: 'Automatic summary', content, tags: [], slug: 'automatic-summary-post' },
        })
        entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
        const published = (await (await admin.content('posts')).list())[0]!.data
        const document = published.content as MarkdownDocument
        const summary = JSON.stringify(document.meta.summary)
        expect(summary).toContain('automatic introduction')
        expect(summary).toContain('/posts/reference')
        expect(summary).not.toContain('cover.png')
        expect(summary).not.toContain('console.log')
        expect(summary).not.toContain('Later body text')
        expect(JSON.stringify(document.nodes)).toContain('Later body text')
        expect(published._siteAdmin.seo.description).toContain('automatic introduction')
        expect(published._siteAdmin.seo.description).not.toContain('Later body text')
        expect((await admin.getEntry(entry.id)).data.content).toBe(content)
    } finally {
        local.close()
    }
})

test('native HTTP summary projection excludes the full body and keeps default/detail responses full', async () => {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const admin = createSiteAdmin({ config, database: drizzleAdapter(local.database, { schema }) })
    const responses: string[] = []
    const client = createSiteAdminClient({
        origin: 'http://synthetic.invalid',
        fetch: async (input, init) => {
            const response = await handlePublicRequest(admin, new Request(String(input), init))
            responses.push(await response.clone().text())
            return response
        },
    })
    try {
        const sentinel = 'FULL_POST_BODY_SUMMARY_SENTINEL'
        const content = `A **projected introduction**.\n\n<!-- more -->\n\n${sentinel} ${'Long body. '.repeat(300)}`
        let entry = await admin.createEntry('posts', {
            data: { title: 'Projected summary', content, tags: [], slug: 'projected-summary-post' },
        })
        entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
        const summary = await client.list('posts', { markdown: 'summary' })
        expect(JSON.stringify(summary[0]!.data.content.nodes)).toContain('projected introduction')
        expect(responses.at(-1)).not.toContain(sentinel)
        const full = await client.list('posts')
        expect(JSON.stringify(full[0]!.data.content.nodes)).toContain(sentinel)
        expect(responses.at(-1)).toContain(sentinel)
        const detail = await client.get('posts', entry.id)
        expect(JSON.stringify(detail?.data.content.nodes)).toContain(sentinel)
        expect(responses.at(-1)).toContain(sentinel)
        await client.list('posts', { markdown: 'summary' })
        expect(responses.at(-1)).not.toContain(sentinel)
        expect((await admin.getEntry(entry.id)).data.content).toBe(content)
    } finally {
        local.close()
    }
})

test('native summary lists retain every article after detail route parsing', async () => {
    const local = openDevelopmentDB({ databasePath: ':memory:' })
    const admin = createSiteAdmin({ config, database: drizzleAdapter(local.database, { schema }) })
    const responses: string[] = []
    const client = createSiteAdminClient({
        origin: 'http://synthetic.invalid',
        fetch: async (input, init) => {
            const response = await handlePublicRequest(admin, new Request(String(input), init))
            responses.push(await response.clone().text())
            return response
        },
    })
    try {
        for (const slug of ['first-summary-article', 'second-summary-article']) {
            let entry = await admin.createEntry('posts', {
                data: {
                    title: slug,
                    content: `${slug} introduction.\n\n<!-- more -->\n\nFULL_ARTICLE_ROUTE_SENTINEL`,
                    tags: [],
                    slug: slug,
                },
            })
            entry = await admin.publishEntry(entry.id, { expectedVersion: entry.version })
            expect(await admin.resolvePath(`/posts/${slug}`)).not.toBeNull()
            expect(JSON.stringify(await client.get('posts', entry.id))).toContain(
                'FULL_ARTICLE_ROUTE_SENTINEL',
            )
        }
        const summary = await client.list('posts', { markdown: 'summary' })
        expect(summary.map((entry) => entry.data.slug).sort()).toEqual([
            'first-summary-article',
            'second-summary-article',
        ])
        expect(responses.at(-1)).not.toContain('FULL_ARTICLE_ROUTE_SENTINEL')
        const full = await client.list('posts')
        expect(full).toHaveLength(2)
        expect(responses.at(-1)).toContain('FULL_ARTICLE_ROUTE_SENTINEL')
    } finally {
        local.close()
    }
})

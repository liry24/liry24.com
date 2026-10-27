import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { expect, test } from 'vitest'

import { builtWorker } from '../helpers/builtWorker'
import { content } from '../helpers/postMarkdown'

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'native emitted Worker preserves authorization, publication, SQL constraints, media and SEO',
    async () => {
        const app = await builtWorker()
        try {
            const admin = await app.session('native-admin'),
                user = await app.session('native-user', 'user')
            const manage = (body: Record<string, unknown>, headers = admin) =>
                app.server.fetch('/api/_liti/manage', {
                    method: 'POST',
                    headers: { ...headers, 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })
            async function ok(body: Record<string, unknown>) {
                const response = await manage(body),
                    text = await response.text()
                expect(response.status, text).toBe(200)
                return JSON.parse(text)
            }
            expect(
                (await manage({ action: 'models' }, { cookie: '', origin: app.url.origin })).status,
            ).toBe(401)
            expect((await manage({ action: 'models' }, user)).status).toBe(200)
            expect(await (await manage({ action: 'models' }, user)).json()).toEqual([])
            expect(
                (
                    await manage(
                        { action: 'models' },
                        { ...admin, origin: 'https://untrusted.invalid' },
                    )
                ).status,
            ).toBe(403)
            expect((await ok({ action: 'models' })).length).toBe(9)
            const editorial = (body: unknown, headers = admin, contentType = 'application/json') =>
                app.server.fetch('/api/admin/posts/proofread', {
                    method: 'POST',
                    headers: { ...headers, 'content-type': contentType },
                    body: JSON.stringify(body),
                })
            expect(
                (await editorial({ body: 'Original' }, { cookie: '', origin: app.url.origin }))
                    .status,
            ).toBe(401)
            expect((await editorial({ body: 'Original' }, user)).status).toBe(403)
            expect(
                (
                    await editorial(
                        { body: 'Original' },
                        { ...admin, origin: 'https://hostile.invalid' },
                    )
                ).status,
            ).toBe(403)
            expect((await editorial({ body: '', publish: true })).status).toBe(400)
            expect((await editorial({ body: 'Original' }, admin, 'text/plain')).status).toBe(415)

            const permission = await app.server.fetch('/api/auth/admin/has-permission', {
                method: 'POST',
                headers: { ...admin, 'content-type': 'application/json' },
                body: JSON.stringify({ permissions: { 'liti:model:posts': ['save'] } }),
            })
            expect(permission.status, await permission.clone().text()).toBe(200)
            expect(await permission.json()).toMatchObject({ success: true })
            const identity = {
                igdbId: 1,
                slug: 'native-game',
                name: 'Native Game',
                metrics: [{ key: 'score', label: 'Score', format: 'integer' }],
            }
            const game = await ok({
                action: 'save',
                model: 'games',
                id: 'igdb-1',
                data: identity,
                ifVersion: null,
            })
            const search = await app.server.fetch('/api/admin/games?q=Native', { headers: admin })
            expect(search.status, await search.clone().text()).toBe(200)
            const duplicate = await Promise.all(
                ['game-a', 'game-b'].map((id) =>
                    manage({
                        action: 'save',
                        model: 'games',
                        id,
                        data: { ...identity, igdbId: 2, slug: id },
                        ifVersion: null,
                    }),
                ),
            )
            expect(duplicate.map((response) => response.status).sort()).toEqual([200, 409])
            expect(
                (
                    await manage(
                        {
                            action: 'save',
                            model: 'games',
                            id: 'forbidden',
                            data: identity,
                            ifVersion: null,
                        },
                        user,
                    )
                ).status,
            ).toBe(403)
            const statData = {
                game: 'igdb-1',
                periodKey: 'act-1',
                period: 'Act 1',
                values: [{ key: 'score', value: 0 }],
            }
            await ok({
                action: 'save',
                model: 'gameStats',
                id: 'stat-1',
                data: statData,
                ifVersion: null,
            })
            expect(
                (
                    await manage({
                        action: 'save',
                        model: 'gameStats',
                        id: 'stat-2',
                        data: statData,
                        ifVersion: null,
                    })
                ).status,
            ).toBe(409)
            expect(
                (
                    await manage({
                        action: 'save',
                        model: 'games',
                        id: 'igdb-1',
                        data: { ...identity, metrics: [] },
                        ifVersion: game.version,
                    })
                ).status,
            ).toBe(400)
            const data = {
                title: '<game:native-game> report',
                tags: [],
                slug: 'native-publication',
            }
            const body = `${content}\n\n<game:native-game>`
            const saved = await ok({
                action: 'save',
                model: 'posts',
                id: 'native-post',
                locale: 'ja',
                ifDigest: null,
                data,
                body,
            })
            const changed = await ok({
                action: 'save',
                model: 'posts',
                id: 'native-post',
                locale: 'ja',
                ifDigest: saved.digest,
                data: { ...data, title: 'Fields only' },
            })
            const draft = await ok({
                action: 'read',
                model: 'posts',
                id: 'native-post',
                locale: 'ja',
            })
            expect(draft.body).toBe(body)
            expect(draft.data.gameMentions).toEqual(['igdb-1'])
            expect(
                (
                    await manage({
                        action: 'save',
                        model: 'posts',
                        id: 'native-post',
                        locale: 'ja',
                        ifDigest: saved.digest,
                        data,
                    })
                ).status,
            ).toBe(409)
            expect(await (await app.server.fetch('/api/_liti?model=posts')).json()).toMatchObject({
                items: [],
                total: 0,
            })
            await ok({
                action: 'publish',
                model: 'posts',
                id: 'native-post',
                digests: { ja: changed.digest },
            })
            const first = await (
                await app.server.fetch('/api/_liti?model=posts&mode=one&id=native-post&locale=ja')
            ).json<any>()
            expect(first.data.authorUserId).toBeUndefined()
            expect(first.publication.firstPublishedAt).toBeTruthy()
            const reviewed = await ok({
                action: 'save',
                model: 'posts',
                id: 'native-post',
                locale: 'ja',
                ifDigest: changed.digest,
                data: { ...data, title: 'Reviewed snapshot' },
            })
            const at = new Date(Date.now() + 60000)
            await ok({
                action: 'schedule',
                model: 'posts',
                id: 'native-post',
                digests: { ja: reviewed.digest },
                at: at.toISOString(),
            })
            const later = await ok({
                action: 'save',
                model: 'posts',
                id: 'native-post',
                locale: 'ja',
                ifDigest: reviewed.digest,
                data: { ...data, title: 'PRIVATE LATER DRAFT' },
            })
            for (let attempt = 0; attempt < 2; attempt++)
                expect(
                    (
                        await app.worker.scheduled({
                            scheduledTime: new Date(at.getTime() + 60000),
                            cron: '* * * * *',
                        })
                    ).outcome,
                ).toBe('ok')
            const live = await (
                await app.server.fetch('/api/_liti?model=posts&mode=one&id=native-post&locale=ja')
            ).json<any>()
            expect(live.data.title).toBe('Reviewed snapshot')
            expect(live.publication.firstPublishedAt).toBe(first.publication.firstPublishedAt)
            expect(
                (await ok({ action: 'read', model: 'posts', id: 'native-post', locale: 'ja' }))
                    .digest,
            ).toBe(later.digest)
            const cards = await (await app.server.fetch('/api/posts/cards')).json<any>()
            expect(cards.items).toHaveLength(1)
            expect(JSON.stringify(cards)).not.toContain('PRIVATE LATER DRAFT')
            expect(JSON.stringify(cards)).not.toContain('Full body')
            const sitemap = await (await app.server.fetch('/api/sitemap/posts')).json<any[]>()
            expect(sitemap).toContainEqual(
                expect.objectContaining({ loc: '/posts/native-publication' }),
            )
            await app.env.MEDIA.put('public.txt', 'public-media')
            await app.env.CONTENT.put('private.txt', 'private-workspace')
            expect(await (await app.server.fetch('/media/public.txt')).text()).toBe('public-media')
            expect((await app.server.fetch('/media/private.txt')).status).toBe(404)
            expect(
                (await app.server.fetch('/api/admin/entries?model=posts', { headers: user }))
                    .status,
            ).toBe(403)
            const entries = await app.server.fetch('/api/admin/entries?model=posts', {
                headers: admin,
            })
            expect(entries.headers.get('cache-control')).toBe('private, no-store')
            expect(await entries.json()).toMatchObject({
                total: 1,
                items: [{ data: { title: 'PRIVATE LATER DRAFT' } }],
            })
            const social = await ok({
                action: 'save',
                model: 'socials',
                id: 'social-1',
                ifVersion: null,
                data: {
                    slug: 'profile',
                    label: 'Profile',
                    href: 'https://example.invalid/profile',
                    icon: '',
                },
            })
            const redirect = await app.server.fetch('/profile', { redirect: 'manual' })
            expect(redirect.status).toBe(302)
            expect(redirect.headers.get('location')).toBe('https://example.invalid/profile')
            const reorder = (version: number) =>
                app.server.fetch('/api/admin/reorder', {
                    method: 'POST',
                    headers: { ...admin, 'content-type': 'application/json' },
                    body: JSON.stringify({
                        model: 'socials',
                        revision: null,
                        entries: [{ id: 'social-1', version }],
                    }),
                })
            const reordered = await Promise.all([reorder(social.version), reorder(social.version)])
            expect(reordered.map((response) => response.status).sort()).toEqual([200, 409])
            for (const path of ['/', '/works', '/arts', '/posts', '/posts/native-publication']) {
                const page = await app.server.fetch(path),
                    html = await page.text()
                expect(page.status, html.slice(0, 500)).toBe(200)
                expect(html).not.toContain('PRIVATE LATER DRAFT')
                if (path === '/posts/native-publication') {
                    expect(html).not.toContain('onerror="marker()"')
                    expect(html).toContain('Code example remains text')
                } else {
                    const image = html.match(
                        /<meta\b[^>]*property="og:image"[^>]*content="([^"]+)"/,
                    )
                    expect(image, `${path} keeps OG image`).not.toBeNull()
                    const url = new URL(image![1]!.replaceAll('&amp;', '&'), app.url)
                    const rendered = await app.server.fetch(url.pathname + url.search)
                    expect(rendered.status, await rendered.clone().text()).toBe(200)
                    expect(rendered.headers.get('content-type')).toMatch(/^image\//)
                    expect((await rendered.arrayBuffer()).byteLength).toBeGreaterThan(1000)
                }
            }
            const serverDirectory = resolve('.output/server')
            for (const path of (await readdir(serverDirectory, { recursive: true })).filter(
                (path) => path.endsWith('.mjs'),
            )) {
                const code = await readFile(resolve(serverDirectory, path), 'utf8')
                for (const marker of ['@litijs/void', 'void/ai', 'LIRY24_DEV_DB_PATH'])
                    expect(code).not.toContain(marker)
            }
        } finally {
            for (const log of app.server.getLogs().filter((log) => log.level === 'error'))
                console.error(log.message)
            await app.close()
        }
    },
    180000,
)

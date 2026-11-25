import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { expect, test } from 'vitest'
import { z } from 'zod'

import { builtWorker } from '../helpers/builtWorker'
import { oidcProvider } from '../helpers/oidc'

const uploadedMediaSchema = z.object({
    pathname: z.string(),
    contentType: z.string().optional(),
    size: z.number().optional(),
})

const adminListSchema = z.object({
    items: z.array(z.object({ id: z.string(), title: z.string() })),
})

const publishScheduleSchema = z.object({
    ok: z.boolean(),
    schedule: z
        .object({
            id: z.string(),
            expect: z.array(z.object({ collection: z.string(), id: z.string() })),
        })
        .optional(),
})

const evlogAuthFailureSchema = z.object({
    status: z.number(),
    path: z.string(),
})

const expectedAdminGatePaths = new Set([
    '/api/admin/content/posts',
    '/api/admin/content/publish',
    '/api/admin/media',
])

function isExpectedHttpErrorLog(message: string): boolean {
    try {
        const parsed = evlogAuthFailureSchema.safeParse(JSON.parse(message))
        if (!parsed.success) {
            return false
        }
        if (
            (parsed.data.status === 401 || parsed.data.status === 403) &&
            expectedAdminGatePaths.has(parsed.data.path)
        ) {
            return true
        }
        return parsed.data.status === 404 && parsed.data.path === '/api/posts/built-worker-post'
    } catch {
        return false
    }
}

async function multipartRequest(
    form: FormData,
    headers: Record<string, string>,
): Promise<{ headers: Record<string, string>; body: Uint8Array }> {
    const serialized = new Request('http://multipart.invalid', { method: 'POST', body: form })
    const contentType = serialized.headers.get('content-type')
    return {
        headers: contentType ? { ...headers, 'content-type': contentType } : headers,
        body: new Uint8Array(await serialized.arrayBuffer()),
    }
}

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the emitted Worker enforces auth gates, serves public/media/content routes, runs mock assistant chat, and keeps preview isolation',
    async () => {
        const provider = await oidcProvider()
        try {
            const app = await builtWorker({
                secrets: {
                    POCKET_ID_TEST_ISSUER: provider.issuer,
                },
            })
            try {
                const admin = await app.session('built-admin', 'admin', 'owner@example.invalid')
                const viewer = await app.session('built-viewer', 'user', 'viewer@example.invalid')
                const jsonHeaders = (headers?: { cookie: string; origin: string }) => ({
                    'content-type': 'application/json',
                    ...(headers ?? { origin: app.url.origin }),
                })

                for (const path of [
                    '/',
                    '/login',
                    '/favicon.ico',
                    '/api/posts/cards',
                    '/api/portfolio/works',
                ]) {
                    expect((await app.server.fetch(path)).status, path).toBe(200)
                }
                expect(await (await app.server.fetch('/api/auth/get-session')).text()).toBe('null')

                for (const path of ['/admin', '/admin/works']) {
                    expect(
                        (await app.server.fetch(path, { redirect: 'manual' })).status,
                        path,
                    ).toBe(302)
                }

                expect((await app.server.fetch('/api/admin/content/posts')).status).toBe(401)
                expect(
                    (
                        await app.server.fetch('/_vitehub/forms/post', {
                            method: 'POST',
                            headers: jsonHeaders(),
                            body: JSON.stringify({}),
                        })
                    ).status,
                ).toBe(401)
                expect(
                    (
                        await app.server.fetch('/api/admin/content/publish', {
                            method: 'POST',
                            headers: jsonHeaders(),
                            body: JSON.stringify({}),
                        })
                    ).status,
                ).toBe(401)
                expect(
                    (
                        await app.server.fetch('/api/admin/media', {
                            method: 'POST',
                            ...(await multipartRequest(new FormData(), { origin: app.url.origin })),
                        })
                    ).status,
                ).toBe(401)
                expect(
                    (
                        await app.server.fetch('/_vitehub/agents/assistant/chat', {
                            method: 'POST',
                            headers: jsonHeaders(),
                            body: JSON.stringify({ messages: [] }),
                        })
                    ).status,
                ).toBe(401)

                expect(
                    (await app.server.fetch('/api/admin/content/posts', { headers: viewer }))
                        .status,
                ).toBe(403)
                expect(
                    (
                        await app.server.fetch('/_vitehub/forms/post', {
                            method: 'POST',
                            headers: jsonHeaders(viewer),
                            body: JSON.stringify({}),
                        })
                    ).status,
                ).toBe(403)
                expect(
                    (
                        await app.server.fetch('/api/admin/content/publish', {
                            method: 'POST',
                            headers: jsonHeaders(viewer),
                            body: JSON.stringify({}),
                        })
                    ).status,
                ).toBe(403)
                expect(
                    (
                        await app.server.fetch('/api/admin/media', {
                            method: 'POST',
                            ...(await multipartRequest(new FormData(), viewer)),
                        })
                    ).status,
                ).toBe(403)
                expect(
                    (
                        await app.server.fetch('/_vitehub/agents/assistant/chat', {
                            method: 'POST',
                            headers: jsonHeaders(viewer),
                            body: JSON.stringify({ messages: [] }),
                        })
                    ).status,
                ).toBe(403)

                const fixtureBytes = await readFile(
                    resolve('tests/fixtures/accessibility-artwork.png'),
                )
                const mediaForm = new FormData()
                mediaForm.append(
                    'file',
                    new File([new Uint8Array(fixtureBytes)], 'sample.png', { type: 'image/png' }),
                )
                mediaForm.append('folder', 'posts')
                const uploadResponse = await app.server.fetch('/api/admin/media', {
                    method: 'POST',
                    ...(await multipartRequest(mediaForm, admin)),
                })
                expect(uploadResponse.status, await uploadResponse.clone().text()).toBe(200)
                const uploaded = uploadedMediaSchema.parse(await uploadResponse.json())
                expect(uploaded.pathname).toMatch(/^posts\/.+\.png$/u)

                const mediaGet = await app.server.fetch(
                    `/media/${uploaded.pathname.split('/').map(encodeURIComponent).join('/')}`,
                )
                expect(mediaGet.status).toBe(200)
                expect(new Uint8Array(await mediaGet.arrayBuffer())).toEqual(
                    new Uint8Array(fixtureBytes),
                )

                for (const [igdbId, slug, name] of [
                    [100, 'first-game', 'First Game'],
                    [200, 'scheduled-game', 'Scheduled Game'],
                ] as const) {
                    const saved = await app.server.fetch('/_vitehub/forms/game', {
                        method: 'POST',
                        headers: jsonHeaders(admin),
                        body: JSON.stringify({ data: { igdbId, slug, name } }),
                    })
                    expect(saved.status, await saved.clone().text()).toBe(201)
                }
                const gameSearch = await app.server.fetch('/api/admin/games?q=100', {
                    headers: admin,
                })
                expect(await gameSearch.json()).toMatchObject({
                    games: [{ id: 'igdb-100', igdbId: 100, slug: 'first-game' }],
                    warning: '',
                })

                const saveResponse = await app.server.fetch('/_vitehub/forms/post', {
                    method: 'POST',
                    headers: jsonHeaders(admin),
                    body: JSON.stringify({
                        id: 'built-worker-post',
                        data: {
                            title: 'Built Worker Post and :game[first-game]',
                            plainTitle: 'Built Worker Post',
                            slug: 'built-worker-post',
                            tags: ['vitehub'],
                            gameMentions: [],
                            order: 0,
                        },
                        body: 'Introduction :game[first-game]\n\n<!-- more -->\n\nPRIVATE_DRAFT_BODY',
                    }),
                })
                expect(saveResponse.status, await saveResponse.clone().text()).toBe(201)

                const beforePublishCards = await (await app.server.fetch('/api/posts/cards')).text()
                expect(beforePublishCards).not.toContain('built-worker-post')
                expect(beforePublishCards).not.toContain('PRIVATE_DRAFT_BODY')

                const adminPostsResponse = await app.server.fetch('/api/admin/content/posts', {
                    headers: admin,
                })
                expect(adminPostsResponse.status).toBe(200)
                expect(adminPostsResponse.headers.get('cache-control')).toBe('private, no-store')
                const adminPosts = adminListSchema.parse(await adminPostsResponse.json())
                expect(adminPosts.items.some((item) => item.id === 'built-worker-post')).toBe(true)

                const publishResponse = await app.server.fetch('/api/admin/content/publish', {
                    method: 'POST',
                    headers: jsonHeaders(admin),
                    body: JSON.stringify({
                        action: 'publish',
                        collection: 'posts',
                        id: 'built-worker-post',
                    }),
                })
                expect(publishResponse.status, await publishResponse.clone().text()).toBe(200)

                const afterPublishCards = await (
                    await app.server.fetch('/api/posts/cards?game=first-game')
                ).text()
                expect(afterPublishCards).toContain('built-worker-post')
                expect(afterPublishCards).toContain('Introduction')
                expect(afterPublishCards).not.toContain('PRIVATE_DRAFT_BODY')

                const postDetail = await app.server.fetch('/api/posts/built-worker-post')
                expect(postDetail.status).toBe(200)
                expect(await postDetail.json()).toMatchObject({
                    data: {
                        plainTitle: 'Built Worker Post and First Game',
                        gameMentions: ['igdb-100'],
                    },
                    body: expect.stringContaining('PRIVATE_DRAFT_BODY'),
                })

                const scheduledDraftResponse = await app.server.fetch('/_vitehub/forms/post', {
                    method: 'POST',
                    headers: jsonHeaders(admin),
                    body: JSON.stringify({
                        id: 'built-worker-post',
                        data: {
                            title: 'Built Worker Post',
                            plainTitle: 'Built Worker Post',
                            slug: 'built-worker-post',
                            tags: ['vitehub'],
                            gameMentions: [],
                            order: 0,
                        },
                        body: 'Introduction :game[scheduled-game]\n\n<!-- more -->\n\nSCHEDULED_DRAFT_UPDATE',
                    }),
                })
                expect(
                    scheduledDraftResponse.status,
                    await scheduledDraftResponse.clone().text(),
                ).toBe(201)
                expect(
                    await (await app.server.fetch('/api/posts/built-worker-post')).text(),
                ).not.toContain('SCHEDULED_DRAFT_UPDATE')

                const scheduleResponse = await app.server.fetch('/api/admin/content/publish', {
                    method: 'POST',
                    headers: jsonHeaders(admin),
                    body: JSON.stringify({
                        action: 'schedule',
                        collection: 'posts',
                        id: 'built-worker-post',
                        at: new Date(Date.now() + 86_400_000).toISOString(),
                    }),
                })
                expect(scheduleResponse.status, await scheduleResponse.clone().text()).toBe(200)
                const schedulePayload = publishScheduleSchema.parse(await scheduleResponse.json())
                expect(schedulePayload.schedule?.id).toBeTruthy()
                expect(schedulePayload.schedule?.expect).toEqual(
                    expect.arrayContaining([
                        { collection: 'posts', id: 'built-worker-post' },
                        { collection: 'games', id: 'igdb-200' },
                    ]),
                )
                expect(await (await app.server.fetch('/api/portfolio/games')).text()).not.toContain(
                    'scheduled-game',
                )

                if (schedulePayload.schedule?.id) {
                    const unscheduleResponse = await app.server.fetch(
                        '/api/admin/content/publish',
                        {
                            method: 'POST',
                            headers: jsonHeaders(admin),
                            body: JSON.stringify({
                                action: 'unschedule',
                                scheduleId: schedulePayload.schedule.id,
                            }),
                        },
                    )
                    expect(unscheduleResponse.status, await unscheduleResponse.clone().text()).toBe(
                        200,
                    )
                }

                const deleteResponse = await app.server.fetch(
                    '/api/admin/content/posts/built-worker-post?publish=true',
                    {
                        method: 'DELETE',
                        headers: admin,
                    },
                )
                expect(deleteResponse.status, await deleteResponse.clone().text()).toBe(200)
                expect((await app.server.fetch('/api/posts/built-worker-post')).status).toBe(404)

                const chatResponse = await app.server.fetch('/_vitehub/agents/assistant/chat', {
                    method: 'POST',
                    headers: jsonHeaders(admin),
                    body: JSON.stringify({
                        id: 'test-assistant-chat',
                        messages: [
                            {
                                id: 'msg-1',
                                role: 'user',
                                parts: [{ type: 'text', text: 'Hello' }],
                            },
                        ],
                        trigger: 'submit-message',
                    }),
                })
                expect(chatResponse.status, await chatResponse.clone().text()).toBe(200)
                expect(await chatResponse.text()).toContain('Content assistant ready')

                const emittedWrangler: unknown = JSON.parse(
                    await readFile(resolve('.output/server/wrangler.json'), 'utf8'),
                )
                expect(emittedWrangler).toMatchObject({
                    name: 'liry24-com',
                    observability: {
                        enabled: true,
                        redact_query_string: true,
                        logs: {
                            enabled: true,
                            invocation_logs: false,
                            head_sampling_rate: 1,
                        },
                        traces: {
                            enabled: false,
                        },
                        issues: {
                            enabled: false,
                        },
                    },
                    preview_urls: true,
                    routes: [
                        {
                            pattern: 'liry24.com',
                            custom_domain: true,
                        },
                    ],
                    r2_buckets: [{ binding: 'STORAGE', bucket_name: 'liry24-com' }],
                    previews: {
                        vars: {
                            APP_ENV: 'dev',
                            NUXT_PUBLIC_SITE_URL: 'https://dev-liry24-com.liry.workers.dev',
                            NUXT_PUBLIC_IMAGES_DOMAIN: 'https://dev-liry24-com.liry.workers.dev',
                        },
                        d1_databases: [
                            {
                                binding: 'DB',
                                database_name: 'liry24-com-dev',
                                database_id: '3c7c6179-12d0-4108-9eea-b3e20d394cef',
                            },
                        ],
                        r2_buckets: [
                            {
                                binding: 'STORAGE',
                                bucket_name: 'liry24-com-dev-storage',
                            },
                        ],
                    },
                })
                const wranglerRoutesSchema = z.object({
                    routes: z.array(z.record(z.string(), z.unknown())),
                })
                expect(wranglerRoutesSchema.parse(emittedWrangler).routes[0]).not.toHaveProperty(
                    'previews_enabled',
                )

                const serverDir = resolve('.output/server')
                const files = (await readdir(serverDir, { recursive: true })).filter((path) =>
                    path.endsWith('.mjs'),
                )
                const output = (
                    await Promise.all(
                        files.map((path) => readFile(resolve(serverDir, path), 'utf8')),
                    )
                ).join('\n')
                for (const family of ['Special Gothic Expanded One', 'Geist Mono']) {
                    expect(output).toContain(family)
                }
                for (const marker of [
                    'openDevelopmentDB',
                    'LIRY24_DEV_DB_PATH',
                    '.data/development/sqlite.db',
                    'drizzle-orm/node-sqlite',
                    '@litijs/void',
                ]) {
                    expect(output).not.toContain(marker)
                }
            } finally {
                const errorLogs = app.server
                    .getLogs()
                    .filter(
                        (entry) =>
                            entry.level === 'error' && !isExpectedHttpErrorLog(entry.message),
                    )
                    .map((entry) => entry.message)
                await app.close()
                expect(errorLogs).toEqual([])
            }
        } finally {
            await provider.close()
        }
    },
    180_000,
)

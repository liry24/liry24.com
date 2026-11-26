import { readFile } from 'node:fs/promises'

import { parseJsonEventStream, uiMessageChunkSchema } from 'ai'
import type { JSONValue } from 'ai'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { builtWorker } from '../helpers/builtWorker'

type Worker = Awaited<ReturnType<typeof builtWorker>>
type Session = Awaited<ReturnType<Worker['session']>>

const postId = 'built-worker-post'
const postPath = `/api/posts/${postId}`
const adminPostPath = `/api/admin/content/posts/${postId}`
const originalBody = 'Introduction :game[first-game]\n\n<!-- more -->\n\nOriginal article.'
const revisedBody = 'Introduction\n\nRevised article.'
const cardsSchema = z.object({ items: z.array(z.object({ id: z.string() })) })
const scheduleSchema = z.object({ id: z.string() })

describe.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')('built Worker', () => {
    let app: Worker
    let admin: Session

    beforeAll(async () => {
        app = await builtWorker()
        admin = await app.session('built-admin', 'admin', 'owner@example.invalid')
    }, 60_000)
    afterAll(async () => app?.close())

    const fetch = (path: string, init?: Parameters<Worker['server']['fetch']>[1]) =>
        app.server.fetch(path, init)
    const post = (path: string, data: JSONValue, session?: Session) =>
        fetch(path, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...session,
                origin: app.url.origin,
            },
            body: JSON.stringify(data),
        })

    test('admin APIs reject anonymous and non-admin callers before processing requests', async () => {
        const viewer = await app.session('built-viewer', 'user')
        for (const [session, status] of [
            [undefined, 401],
            [viewer, 403],
        ] as const) {
            expect((await fetch('/api/admin/content/posts', { headers: session })).status).toBe(
                status,
            )
            for (const path of [
                '/_vitehub/forms/post',
                '/api/admin/content/publish',
                '/api/admin/media',
                '/_vitehub/agents/assistant/chat',
            ])
                expect((await post(path, {}, session)).status, path).toBe(status)
        }
    })

    test('uploaded media can be downloaded without an admin session', async () => {
        const bytes = new Uint8Array(await readFile('tests/fixtures/accessibility-artwork.png'))
        const form = new FormData()
        form.append('file', new File([bytes], 'sample.png', { type: 'image/png' }))
        form.append('folder', 'posts')
        const multipart = new Request(app.url, { method: 'POST', body: form })
        const upload = await fetch('/api/admin/media', {
            method: 'POST',
            headers: { ...Object.fromEntries(multipart.headers), ...admin },
            body: new Uint8Array(await multipart.arrayBuffer()),
        })
        expect(upload.status, await upload.clone().text()).toBe(200)
        const { pathname } = z.object({ pathname: z.string() }).parse(await upload.json())
        const download = await fetch(
            `/media/${pathname.split('/').map(encodeURIComponent).join('/')}`,
        )
        expect(download.status).toBe(200)
        expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes)
    })

    test('publish and schedule keep drafts separate from the public article', async () => {
        await app.env.DB.prepare(
            'INSERT INTO game_catalog (id, igdb_id, slug, data) VALUES (?, ?, ?, ?)',
        )
            .bind(
                'igdb-100',
                100,
                'first-game',
                JSON.stringify({
                    igdbId: 100,
                    slug: 'first-game',
                    name: 'First Game',
                    order: 0,
                    metrics: [],
                }),
            )
            .run()
        const save = (body: string) =>
            post(
                '/_vitehub/forms/post',
                {
                    id: postId,
                    data: { title: 'Article about :game[first-game]', slug: postId },
                    body,
                },
                admin,
            )
        const publish = (action: 'publish' | 'schedule', at?: string) =>
            post(
                '/api/admin/content/publish',
                { action, collection: 'posts', id: postId, at },
                admin,
            )
        const publicCardIds = async (path: string) => {
            const response = await fetch(path)
            expect(response.status).toBe(200)
            return cardsSchema.parse(await response.json()).items.map(({ id }) => id)
        }
        const readDraft = async () => {
            const response = await fetch(adminPostPath, { headers: admin })
            expect(response.status).toBe(200)
            expect(response.headers.get('cache-control')).toBe('private, no-store')
            return z
                .object({ body: z.string(), schedules: z.array(scheduleSchema) })
                .parse(await response.json())
        }
        const readPublished = async () => {
            const response = await fetch(postPath)
            expect(response.status).toBe(200)
            return await response.json()
        }

        expect((await save(originalBody)).status).toBe(201)
        expect((await readDraft()).body).toBe(originalBody)
        expect((await fetch(postPath)).status).toBe(404)
        expect(await publicCardIds('/api/posts/cards')).not.toContain(postId)

        expect((await publish('publish')).status).toBe(200)
        expect(await publicCardIds('/api/posts/cards?game=first-game')).toContain(postId)
        const published = await readPublished()
        expect(published).toMatchObject({
            id: postId,
            data: { plainTitle: 'Article about First Game', gameMentions: ['igdb-100'] },
            body: originalBody,
        })

        expect((await save(revisedBody)).status).toBe(201)
        const scheduleResponse = await publish(
            'schedule',
            new Date(Date.now() + 86_400_000).toISOString(),
        )
        expect(scheduleResponse.status, await scheduleResponse.clone().text()).toBe(200)
        const { schedule } = z
            .object({ schedule: scheduleSchema })
            .parse(await scheduleResponse.json())
        expect(await readDraft()).toMatchObject({ body: revisedBody, schedules: [schedule] })
        expect(await readPublished()).toEqual(published)

        const unschedule = await post(
            '/api/admin/content/publish',
            {
                action: 'unschedule',
                scheduleId: schedule.id,
            },
            admin,
        )
        expect(unschedule.status).toBe(200)
        expect((await readDraft()).schedules).toEqual([])
        expect(
            (await fetch(`${adminPostPath}?publish=true`, { method: 'DELETE', headers: admin }))
                .status,
        ).toBe(200)
        expect((await fetch(postPath)).status).toBe(404)
    }, 60_000)

    test('an admin can receive a complete assistant chat stream', async () => {
        const response = await post(
            '/_vitehub/agents/assistant/chat',
            {
                id: 'test-assistant-chat',
                messages: [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
                trigger: 'submit-message',
            },
            admin,
        )
        expect(response.status).toBe(200)
        if (!response.body) throw new Error('Assistant response did not contain a stream')

        let reply = ''
        let finished = false
        const stream = parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema })
        for await (const event of stream) {
            if (!event.success) throw event.error

            const chunk = event.value
            if (chunk.type === 'error') throw new Error(chunk.errorText)

            if (chunk.type === 'text-delta') reply += chunk.delta
            if (chunk.type === 'finish') finished = true
        }
        expect(reply.trim()).toBeTruthy()
        expect(finished).toBe(true)
    })
})

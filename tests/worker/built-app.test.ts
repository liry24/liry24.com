import { readFile } from 'node:fs/promises'

import { parseJsonEventStream, uiMessageChunkSchema } from 'ai'
import type { JSONValue } from 'ai'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { z } from 'zod'

import { builtWorker } from '../helpers/builtWorker'
import { multipartRequest, seedGameCatalog } from '../helpers/workerSeed'

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
            expect((await fetch('/api/admin/posts/tags', { headers: session })).status).toBe(status)
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
        const upload = await fetch('/api/admin/media', {
            method: 'POST',
            ...(await multipartRequest(form, admin)),
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
        await seedGameCatalog(app.env.DB, 'igdb-100', {
            igdbId: 100,
            slug: 'first-game',
            name: 'First Game',
            order: 0,
            metrics: [],
        })
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

    test('undated posts use the publication timestamp and suggestions rank published tags', async () => {
        const save = async (title: string, tags: Array<string>, authoredAt?: string) => {
            const response = await post(
                '/_vitehub/forms/post',
                { data: { title, tags, authoredAt }, body: 'A test post.' },
                admin,
            )
            expect(response.status, await response.clone().text()).toBe(201)
            return z
                .object({ id: z.string(), slug: z.string(), digest: z.string() })
                .parse(await response.json())
        }
        const publish = (saved: { id: string; digest: string }) =>
            post(
                '/api/admin/content/publish',
                { action: 'publish', collection: 'posts', ...saved },
                admin,
            )

        const undated = await save('First release', ['writing', 'release', 'writing'])
        expect(undated.slug).toBe('first_release')
        const since = Date.now()
        const publication = await publish(undated)
        expect(publication.status, await publication.clone().text()).toBe(200)
        const receipt = z
            .object({
                result: z.object({ revision: z.object({ createdAt: z.iso.datetime() }) }),
            })
            .parse(await publication.json())
        const date = receipt.result.revision.createdAt
        expect(Date.parse(date)).toBeGreaterThanOrEqual(since)
        const detail = await fetch('/api/posts/first_release')
        expect(await detail.json()).toMatchObject({ publishedAt: date })

        const authoredAt = '2020-01-01T00:00:00.000Z'
        const backdated = await save('Earlier writing', ['writing', 'notes'], authoredAt)
        expect((await publish(backdated)).status).toBe(200)
        await save('Unpublished notes', ['draft-only'])

        const cards = await fetch('/api/posts/cards')
        expect(await cards.json()).toMatchObject({
            items: [
                { id: undated.id, date },
                { id: backdated.id, date: authoredAt },
            ],
        })
        const tags = await fetch('/api/admin/posts/tags', { headers: admin })
        expect(await tags.json()).toEqual({ tags: ['writing', 'notes', 'release'] })
    })

    test('creates unique automatic slugs and preserves them across edits', async () => {
        const data = { name: 'Café OpenSource', icon: 'lucide:code' }
        const save = (input: JSONValue) => post('/_vitehub/forms/skill', input, admin)
        const created = await save({ data })
        expect(created.status, await created.clone().text()).toBe(201)
        expect(await created.json()).toEqual({ id: 'cafe_open_source' })
        const duplicate = await save({ data })
        expect(duplicate.status, await duplicate.clone().text()).toBe(201)
        expect(await duplicate.json()).toEqual({ id: 'cafe_open_source_2' })
        expect((await save({ data: { ...data, slug: 'cafe_open_source' } })).status).toBe(409)

        const id = 'cafe_open_source'
        expect((await save({ id, data: { ...data, name: 'Edited name' } })).status).toBe(201)
        const updated = await fetch(`/api/admin/content/skills/${id}`, { headers: admin })
        expect(await updated.json()).toMatchObject({
            data: { name: 'Edited name', slug: id },
        })

        const cjk = await save({ data: { ...data, name: '日本語' } })
        expect(cjk.status, await cjk.clone().text()).toBe(201)
        expect(await cjk.json()).toEqual({ id: expect.stringMatching(/^[a-z0-9]{12}$/u) })
    })
})

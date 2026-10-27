import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { expect, test } from 'vitest'

import { builtWorker } from '../helpers/builtWorker'

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the emitted native Worker preserves commit activity, account isolation, article identity and OG assets',
    async () => {
        const app = await builtWorker()
        try {
            const admin = await app.session('activity-admin')
            const owner = await app.session('activity-owner', 'user')
            const manage = (input: Record<string, unknown>, headers = admin) =>
                app.server.fetch('/api/_liti/manage', {
                    method: 'POST',
                    headers: {
                        origin: app.url.origin,
                        ...headers,
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify(input),
                })
            const ok = async (input: Record<string, unknown>) => {
                const response = await manage(input),
                    text = await response.text()
                expect(response.status, text).toBe(200)
                return JSON.parse(text)
            }
            const activity = async () => {
                const response = await app.server.fetch(
                    '/api/admin/users/~activity-admin/activity',
                    { headers: admin },
                )
                expect(response.status, await response.clone().text()).toBe(200)
                expect(response.headers.get('cache-control')).toBe('private, no-store')
                return await response.json<{
                    items: { action: string; label: string; actorId: string }[]
                    total: number
                }>()
            }
            const compose = (headers: Record<string, string> = {}) =>
                app.server.fetch('/api/admin/compose', {
                    method: 'POST',
                    headers: {
                        origin: app.url.origin,
                        ...headers,
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        prompt: 'new post',
                        locale: 'ja',
                        timeZone: 'Asia/Tokyo',
                    }),
                })
            const missingOrigin = await app.server.fetch('/api/admin/compose', { method: 'POST' })
            expect(missingOrigin.status).toBe(403)
            expect((await compose({ origin: 'https://untrusted.invalid' })).status).toBe(403)
            const anonymous = await compose()
            expect(anonymous.status, await anonymous.clone().text()).toBe(401)
            expect((await compose(owner)).status).toBe(403)
            const invalid = await app.server.fetch('/api/admin/compose', {
                method: 'POST',
                headers: { ...admin, 'content-type': 'application/json' },
                body: JSON.stringify({ prompt: '' }),
            })
            expect(invalid.status).toBe(400)

            for (const path of ['/favicon.ico', '/login'])
                expect((await app.server.fetch(path)).status).toBe(200)
            expect(await (await app.server.fetch('/api/auth/get-session')).text()).toBe('null')
            expect(
                (await manage({ action: 'models' }, { origin: app.url.origin, cookie: '' })).status,
            ).toBe(401)
            expect((await app.server.fetch('/admin/works', { redirect: 'manual' })).status).toBe(
                302,
            )

            const first = await ok({
                action: 'save',
                model: 'posts',
                id: 'activity-post',
                locale: 'ja',
                ifDigest: null,
                data: { title: 'Activity snapshot', slug: 'activity-check', tags: [] },
                body: 'PRIVATE CONTENT',
            })
            const updated = await ok({
                action: 'save',
                model: 'posts',
                id: first.id,
                locale: 'ja',
                ifDigest: first.digest,
                data: { title: 'Changed title', slug: 'activity-check', tags: [] },
                body: 'PRIVATE CONTENT',
            })
            await ok({
                action: 'publish',
                model: 'posts',
                id: first.id,
                digests: { ja: updated.digest },
            })
            const inspected = await ok({
                action: 'inspect',
                model: 'posts',
                id: first.id,
                locale: 'ja',
            })
            await ok({
                action: 'unpublish',
                model: 'posts',
                id: first.id,
                ifHead: inspected.publishedHead,
            })
            const scheduled = await ok({
                action: 'schedule',
                model: 'posts',
                id: first.id,
                digests: { ja: updated.digest },
                at: new Date(Date.now() + 86400000).toISOString(),
            })
            await ok({
                action: 'cancelSchedule',
                model: 'posts',
                id: first.id,
                schedule: scheduled.id,
            })
            const restored = await ok({
                action: 'restore',
                model: 'posts',
                id: first.id,
                locale: 'ja',
                ifDigest: updated.digest,
                revision: first.revision,
            })
            const beforeFailures = (await activity()).total
            expect(
                (
                    await manage({
                        action: 'save',
                        model: 'posts',
                        id: first.id,
                        locale: 'ja',
                        ifDigest: restored.digest,
                        data: { title: '', tags: [] },
                    })
                ).status,
            ).toBe(400)
            expect(
                (
                    await manage({
                        action: 'save',
                        model: 'posts',
                        id: first.id,
                        locale: 'ja',
                        ifDigest: null,
                        data: { title: 'Stale', tags: [] },
                    })
                ).status,
            ).toBe(409)
            expect((await activity()).total).toBe(beforeFailures)
            await ok({
                action: 'remove',
                model: 'posts',
                id: first.id,
                locale: 'ja',
                ifDigest: restored.digest,
            })
            const social = await ok({
                action: 'save',
                model: 'socials',
                id: 'activity-social',
                ifVersion: null,
                data: {
                    label: 'Sort snapshot',
                    slug: 'sort-snapshot',
                    href: 'https://example.invalid',
                    icon: '',
                },
            })
            const order = await app.server.fetch('/api/admin/reorder', {
                method: 'POST',
                headers: { ...admin, 'content-type': 'application/json' },
                body: JSON.stringify({
                    model: 'socials',
                    revision: null,
                    entries: [{ id: social.id, version: social.version }],
                }),
            })
            expect(order.status, await order.clone().text()).toBe(200)
            const events = await activity()
            expect(events.items.map((event) => event.action)).toEqual(
                expect.arrayContaining([
                    'content.create',
                    'content.update',
                    'content.publish',
                    'content.unpublish',
                    'content.schedule',
                    'content.cancelSchedule',
                    'content.restore',
                    'content.delete',
                    'content.sort',
                ]),
            )
            expect(events.items.find((event) => event.action === 'content.delete')).toMatchObject({
                label: 'Activity snapshot',
                actorId: 'activity-admin',
            })
            expect(JSON.stringify(events)).not.toContain('PRIVATE CONTENT')
            expect(JSON.stringify(events)).not.toContain(admin.cookie)

            await app.env.DB.prepare(
                'INSERT INTO admin_event (id,actor_id,action,target_id,label,created_at) VALUES (?,?,?,?,?,?)',
            )
                .bind(
                    'private-event',
                    'activity-owner',
                    'session.revoke',
                    'private-session',
                    'Private session activity',
                    Date.now(),
                )
                .run()
            for (const headers of [owner, admin]) {
                const response = await app.server.fetch(
                    '/api/admin/users/~activity-owner/activity',
                    { headers },
                )
                expect(response.status).toBe(200)
                expect(await response.json()).toMatchObject({
                    items: [{ action: 'session.revoke', label: 'Private session activity' }],
                })
            }
            expect(
                (
                    await app.server.fetch('/api/admin/users/~activity-admin/activity', {
                        headers: owner,
                    })
                ).status,
            ).toBe(403)
            expect((await app.server.fetch('/admin/users', { headers: owner })).status).toBe(403)
            await app.env.DB.prepare("UPDATE user SET role = 'editor' WHERE id = ?")
                .bind('activity-admin')
                .run()
            const denied = await app.server.fetch('/api/admin/users/~activity-owner/activity', {
                headers: admin,
            })
            expect(denied.status).toBe(403)
            expect(await denied.text()).not.toContain('Private session activity')
            await app.env.DB.prepare("UPDATE user SET role = 'user' WHERE id = ?")
                .bind('activity-admin')
                .run()
            expect(
                (
                    await app.server.fetch('/api/admin/users/~activity-admin/activity', {
                        headers: admin,
                    })
                ).status,
            ).toBe(200)
            const spoof = await app.server.fetch('/api/auth/admin/has-permission', {
                method: 'POST',
                headers: { ...admin, 'content-type': 'application/json' },
                body: JSON.stringify({ role: 'admin', permissions: { activity: ['readAny'] } }),
            })
            expect(await spoof.json()).toMatchObject({ success: false })
            await app.env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
                .bind('activity-admin')
                .run()
            await app.env.DB.prepare('UPDATE session SET expires_at = ? WHERE user_id = ?')
                .bind(Date.now() - 1, 'activity-admin')
                .run()
            expect((await compose(admin)).status).toBe(401)

            const server = resolve('.output/server')
            const files = (await readdir(server, { recursive: true })).filter((path) =>
                path.endsWith('.mjs'),
            )
            const output = (
                await Promise.all(files.map((path) => readFile(resolve(server, path), 'utf8')))
            ).join('\n')
            for (const family of ['Special Gothic Expanded One', 'Geist Mono'])
                expect(output).toContain(family)
            for (const marker of [
                'openDevelopmentDB',
                'LIRY24_DEV_DB_PATH',
                '.data/development/sqlite.db',
                'drizzle-orm/node-sqlite',
                'node-sqlite/migrator',
                '@litijs/void',
                'void/ai',
            ])
                expect(output).not.toContain(marker)
        } finally {
            for (const log of app.server.getLogs().filter((log) => log.level === 'error'))
                console.error(log.message)
            await app.close()
        }
    },
    180000,
)

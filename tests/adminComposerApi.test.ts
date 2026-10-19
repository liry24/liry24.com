import { fileURLToPath } from 'node:url'

import { fetch, setup, getServerLogs, clearServerLogs } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'

import type { ComposerBatch } from '../shared/utils/adminComposer'

await setup({
    rootDir: fileURLToPath(new URL('./fixtures/compose', import.meta.url)),
    dev: false,
    server: true,
    browser: false,
    setupTimeout: 120_000,
})
const input = { prompt: 'New post', requestId: 'request1', locale: 'ja', timeZone: 'Asia/Tokyo' }
const request = (body: unknown = input, headers: Record<string, string> = {}) =>
    fetch('/api/admin/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-fixture-role': 'admin', ...headers },
        body: JSON.stringify(body),
    })

test('single records return the canonical JSON batch and private cache headers', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const batch = (await response.json()) as ComposerBatch
    expect(batch).toMatchObject({
        requestId: input.requestId,
        items: [{ id: 'request1.0', plan: { model: 'posts', intent: 'create' } }],
    })
    expect(batch.items).toHaveLength(1)
}, 20_000)

test.each([
    { body: input, headers: { 'x-fixture-role': '' }, status: 401 },
    { body: input, headers: { 'x-fixture-role': 'user' }, status: 403 },
    { body: input, headers: { 'content-type': 'text/plain' }, status: 415 },
    { body: { ...input, requestId: undefined }, headers: {}, status: 400 },
    { body: { ...input, model: 'posts', entryId: 'entry' }, headers: {}, status: 400 },
    { body: { ...input, batch: true }, headers: {}, status: 400 },
    {
        body: {
            ...input,
            items: [{ id: 'request1.0', source: { start: 0, end: 4 }, model: 'works' }],
        },
        headers: { 'x-fixture-case': 'socials-only' },
        status: 403,
    },
    {
        body: { ...input, context: { model: 'works' } },
        headers: { 'x-fixture-case': 'socials-only' },
        status: 403,
    },
    {
        body: {
            ...input,
            items: [{ id: 'request1.0', source: { start: 0, end: 4 }, entryId: 'entry' }],
        },
        headers: {},
        status: 400,
    },
])(
    'invalid or unauthorized HTTP requests are rejected before inference ($status)',
    async ({ body, headers, status }) => {
        clearServerLogs()
        const response = await request(body, headers)
        expect(response.status).toBe(status)
        expect(getServerLogs().join('\n')).not.toContain('admin-compose')
    },
)

test.each([
    ['usage-limit', 429, 'usage limit'],
    ['timeout', 504, 'timed out'],
    ['upstream-error', 502, 'Could not prepare'],
] as const)('AI failures use HTTP errors: %s', async (prompt, status, message) => {
    const response = await request({ ...input, prompt })
    expect(response.status).toBe(status)
    const body = await response.text()
    expect(body).toContain(message)
    expect(body).not.toContain('Synthetic upstream details')
})

test.each([false, true])(
    'timings count overlapping lookups once, including failures (%s)',
    async (fails) => {
        clearServerLogs()
        const response = await request(
            { ...input, prompt: 'lookup' },
            fails ? { 'x-fixture-case': 'lookup-failure' } : {},
        )
        expect(response.status).toBe(fails ? 502 : 200)
        expect(response.headers.get('server-timing')).toMatch(/^authorize;dur=/)
        await expect.poll(() => getServerLogs().join('\n')).toContain('admin-compose')
        const logs = getServerLogs().join('\n')
        const lookupMs = Number(logs.match(/lookupMs: ([\d.]+)/)?.[1])
        expect(lookupMs).toBeGreaterThanOrEqual(fails ? 30 : 80)
        expect(lookupMs).toBeLessThan(400)
        expect(logs).toContain('inferenceCalls: 1')
    },
)

test('explicit entry selection uses the JSON contract and does not log content', async () => {
    clearServerLogs()
    const prompt = '記事タイトル「@NewLabel」に変更'
    const response = await request({
        ...input,
        prompt,
        items: [
            {
                id: 'request1.0',
                source: { start: 0, end: prompt.length },
                model: 'posts',
                entryId: 'entry',
            },
        ],
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
        items: [{ plan: { intent: 'edit', entryId: 'entry', values: { title: '@NewLabel' } } }],
    })
    await expect.poll(() => getServerLogs().join('\n')).toContain('admin-compose')
    expect(getServerLogs().join('\n')).not.toContain('@NewLabel')
})

const importGame = (
    scenario = '',
    body: unknown = { igdbId: 1, slug: 'untrusted-slug', name: 'untrusted name' },
    role = 'admin',
) =>
    fetch('/api/admin/games', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-fixture-case': scenario,
            'x-fixture-role': role,
        },
        body: JSON.stringify(body),
    })

test('game imports refetch canonical metadata and use one identity for existing or simultaneous imports', async () => {
    const result = await importGame()
    expect(result.status, `${await result.clone().text()}\n${getServerLogs().join('\n')}`).toBe(200)
    expect(await result.json()).toEqual({
        id: 'igdb-1',
        igdbId: 1,
        slug: 'exact--igdb-slug',
        name: 'Exact Game',
        cover: null,
    })
    expect(result.headers.get('cache-control')).toBe('private, no-store')
    await expect.poll(() => getServerLogs().join('\n')).toContain('fixture-game-created')
    clearServerLogs()
    expect((await importGame('existing')).status).toBe(200)
    expect(getServerLogs().join('\n')).not.toMatch(/fixture-igdb-query|fixture-game-created/)
    expect((await importGame('simultaneous')).status).toBe(200)
    expect((await importGame('save-failure')).status).toBe(500)
})

test('game imports reject unauthorized, invalid or mismatched requests before saving', async () => {
    clearServerLogs()
    expect((await importGame('', { igdbId: 1 }, '')).status).toBe(401)
    expect((await importGame('', { igdbId: 1 }, 'user')).status).toBe(403)
    expect((await importGame('', { igdbId: '1' })).status).toBe(400)
    expect(getServerLogs().join('\n')).not.toMatch(/fixture-igdb-query|fixture-game-created/)
    expect((await importGame('mismatch')).status).toBe(404)
    expect(getServerLogs().join('\n')).not.toContain('fixture-game-created')
})

test('game searches retain local candidates when IGDB is unavailable', async () => {
    clearServerLogs()
    const headers = { 'x-fixture-role': 'admin' }
    const local = await fetch('/api/admin/games', { headers })
    expect(local.status).toBe(200)
    expect(await local.json()).toMatchObject({
        games: [{ id: 'igdb-1', slug: 'exact--igdb-slug' }],
        warning: '',
    })
    expect(getServerLogs().join('\n')).not.toContain('fixture-igdb-query')
    const remote = await fetch('/api/admin/games?q=game', {
        headers: { ...headers, 'x-fixture-case': 'offline' },
    })
    expect(await remote.json()).toMatchObject({
        games: [{ id: 'igdb-1' }],
        warning: expect.stringContaining('unavailable'),
    })
    expect(
        (await fetch('/api/admin/games', { headers: { 'x-fixture-role': 'user' } })).status,
    ).toBe(403)
    expect(
        (await fetch('/api/admin/games', { headers: { 'x-fixture-role': 'gameReader' } })).status,
    ).toBe(200)
    expect((await importGame('', { igdbId: 1 }, 'gameReader')).status).toBe(403)
    expect(
        (await fetch('/api/admin/games', { headers: { 'x-fixture-role': 'gameImporter' } })).status,
    ).toBe(403)
    expect((await importGame('', { igdbId: 1 }, 'gameImporter')).status).toBe(200)
})

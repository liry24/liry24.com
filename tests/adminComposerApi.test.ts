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
})

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

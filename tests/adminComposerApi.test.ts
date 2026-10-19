import { useAdmin } from '@liria24/site-admin/server'
import { readBody } from 'nuxt/server'
import { afterEach, expect, test, vi } from 'vitest'

import { evaluateClef } from '../server/ai/clef'
import handler from '../server/api/admin/compose.post'
import { composerModels } from '../shared/utils/adminComposer'
import { adminModels } from './helpers/adminModels'

vi.mock('@liria24/site-admin/server', () => ({ useAdmin: vi.fn() }))
vi.mock('@liria24/site-admin/internal/runtime/nitro2', () => ({
    getNitroRequest: (event: unknown) => event,
}))
vi.mock('nuxt/server', () => ({
    defineEventHandler: (handler: unknown) => handler,
    readBody: vi.fn(),
    createError: (error: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(error.statusMessage), error),
}))
vi.mock('../server/ai/clef', () => ({ evaluateClef: vi.fn() }))

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetAllMocks()
})

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const event = () =>
    ({
        req: new Request('https://test.invalid/api/admin/compose', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
        }),
    }) as Parameters<typeof handler>[0]

test.each([
    { selected: false, fails: false },
    { selected: true, fails: false },
    { selected: false, fails: true },
])('timings count overlapping reads once, including failures (%j)', async ({ selected, fails }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const network = vi.fn(() => {
        throw new Error('Network is forbidden in this test')
    })
    vi.stubGlobal('fetch', network)
    vi.stubGlobal(
        'requireUserSession',
        vi.fn(async () => {
            await delay(10)
        }),
    )
    const logs = vi.spyOn(console, 'info').mockImplementation(() => {})
    let reads = 0
    const admin = {
        models: vi.fn(async () => {
            await delay(15)
            return adminModels
        }),
        entries: {
            list: vi.fn(async () => {
                const rejects = fails && reads++ === 0
                await delay(rejects ? 40 : 100)
                if (rejects) throw new Error('Synthetic lookup failure')
                return { items: [], total: 0 }
            }),
            get: vi.fn(async () => {
                await delay(30)
                return { id: 'entry', data: { label: 'Old' } }
            }),
        },
    }
    vi.mocked(useAdmin).mockReturnValue(admin as never)
    vi.mocked(readBody).mockResolvedValue({
        prompt: selected ? 'ラベル「@NewLabel」に変更' : '一覧を表示',
        locale: 'ja',
        timeZone: 'Asia/Tokyo',
        ...(selected ? { model: 'socials', entryId: 'entry' } : {}),
    })
    let round = 0
    vi.mocked(evaluateClef).mockImplementation(async ({ questions }) => {
        await delay(20)
        const choices: Record<string, string> = selected
            ? round++ === 0
                ? { model: 'socials', intent: 'edit', formDetails: 'resolve' }
                : { intent: 'edit', 'field.label': '@NewLabel' }
            : { model: 'clarify', intent: 'search' }
        return {
            answers: Object.fromEntries(
                Object.entries(questions).map(([key, question]) => {
                    const wanted = choices[key]
                    const choice =
                        wanted === undefined
                            ? Object.keys(question.criteria)[0]!
                            : Object.hasOwn(question.criteria, wanted)
                              ? wanted
                              : Object.entries(question.criteria).find(
                                    ([, value]) => value === wanted,
                                )![0]
                    return [key, { choice }]
                }),
            ),
        }
    })
    const pending = handler(event())
    await vi.advanceTimersByTimeAsync(1000)
    const response = await pending
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain(fails ? '"type":"error"' : '"type":"complete"')
    expect(response.headers.get('Server-Timing')).toBe('authorize;dur=25.0')
    expect(admin.entries.list).toHaveBeenCalledTimes(selected ? 0 : composerModels.length)
    expect(admin.entries.get).toHaveBeenCalledTimes(selected ? 1 : 0)
    expect(logs).toHaveBeenCalledTimes(1)
    expect(logs.mock.calls[0]![0]).toBe('admin-compose')
    const metrics = logs.mock.calls[0]![1]
    expect(metrics).toMatchObject({
        authorizationMs: 25,
        lookupMs: selected ? 30 : fails ? 40 : 100,
        inferenceMs: selected ? 40 : 20,
        inferenceCalls: selected ? 2 : 1,
        totalMs: selected ? 95 : fails ? 85 : 145,
    })
    expect(metrics.inferences).toHaveLength(selected ? 2 : 1)
    expect(metrics.inferences[0].questionCount).toBe(composerModels.length + 4)
    for (const inference of metrics.inferences) {
        expect(Object.keys(inference).sort()).toEqual([
            'durationMs',
            'payloadBytes',
            'questionCount',
        ])
        expect(inference.durationMs).toBe(20)
        expect(inference.payloadBytes).toBeGreaterThan(0)
    }
    expect(JSON.stringify(metrics)).not.toContain('@NewLabel')
    expect(network).not.toHaveBeenCalled()
})

test('batch selections cannot bypass allowed model checks', async () => {
    vi.stubGlobal(
        'requireUserSession',
        vi.fn(async () => {}),
    )
    vi.mocked(useAdmin).mockReturnValue({
        models: vi.fn(async () => adminModels.filter((model) => model.name === 'socials')),
    } as never)
    vi.mocked(readBody).mockResolvedValue({
        prompt: 'test',
        locale: 'ja',
        timeZone: 'Asia/Tokyo',
        batch: true,
        requestId: 'request1',
        items: [{ id: 'request1.0', source: { start: 0, end: 4 }, model: 'works' }],
    })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 403 })
    expect(evaluateClef).not.toHaveBeenCalled()
})

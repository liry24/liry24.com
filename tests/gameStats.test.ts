import { resolveLitiConfig } from 'liti'
import { createLitiClient } from 'liti/client'
import { createRuntime } from 'liti/server'
import { handlePublicRequest } from 'liti/server'
import { expect, test } from 'vitest'
import { withRuntimeEnv } from 'void/_env'

import config from '../liti.config'
import { gameValueIssues, formatGameValue, type GameMetric } from '../shared/utils/games'
import { openTestDatabase } from './helpers/database'
const metrics: GameMetric[] = [
    {
        key: 'peakRank',
        label: 'Highest rank',
        format: 'integer',
        positions: [{ value: 2100, label: 'Immortal 1', color: '#EF4444' }],
    },
    { key: 'winRate', label: 'Win rate', format: 'percent' },
    { key: 'kd', label: 'K/D', format: 'decimal' },
    { key: 'matches', label: 'Matches', format: 'integer' },
]
test('game stats validate configured metrics and preserve zero separately from missing values', () => {
    expect(
        gameValueIssues(metrics, [
            { key: 'winRate', value: 0 },
            { key: 'matches', value: 0 },
        ]),
    ).toEqual([])
    for (const values of [
        [{ key: 'winRate', value: 101 }],
        [{ key: 'matches', value: 1.5 }],
        [{ key: 'kd', value: -1 }],
        [{ key: 'unknown', value: 1 }],
        [
            { key: 'kd', value: 1 },
            { key: 'kd', value: 2 },
        ],
    ])
        expect(gameValueIssues(metrics, values).length).toBeGreaterThan(0)
    expect(formatGameValue(undefined)).toBe('—')
    expect(formatGameValue({ key: 'winRate', value: 0 }, metrics[1])).toBe('0%')
    expect(
        formatGameValue({ key: 'peakRank', value: 2123, label: 'Immortal 1 23 RR' }, metrics[0]),
    ).toBe('Immortal 1 23 RR')
})
test('server derives mentions per published/draft/translated revision and preserves historic stats metadata', async () => {
    const local = openTestDatabase()
    try {
        await withRuntimeEnv(local.env, async () => {
            const admin = createRuntime({
                config: resolveLitiConfig(config, []),
                database: local.database,
                locales: { defaultLocale: 'ja', supported: ['ja', 'en'] },
            })
            const game = await admin.createEntry(
                'games',
                {
                    id: 'igdb-126459',
                    data: {
                        igdbId: 126459,
                        slug: 'valorant',
                        name: 'VALORANT',
                        metrics,
                        primaryMetric: 'peakRank',
                    },
                },
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            await expect(
                admin.createEntry(
                    'games',
                    {
                        data: { igdbId: 126459, slug: 'valorant', name: 'VALORANT', metrics },
                    },
                    { actor: { id: 'synthetic-admin', roles: ['admin'] } },
                ),
            ).rejects.toThrow()
            const period = await admin.createEntry(
                'gameStats',
                {
                    data: {
                        game: game.id,
                        periodKey: 'act-1',
                        period: 'Act 1',
                        order: 1,
                        values: [
                            {
                                key: 'peakRank',
                                value: 2123,
                                label: 'Immortal 1 23 RR',
                                color: '#EF4444',
                            },
                            { key: 'winRate', value: 0 },
                        ],
                    },
                },
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            await expect(
                admin.createEntry(
                    'gameStats',
                    {
                        data: { ...period.data, values: [{ key: 'winRate', value: 101 }] },
                    },
                    { actor: { id: 'synthetic-admin', roles: ['admin'] } },
                ),
            ).rejects.toThrow()
            await expect(
                admin.createEntry(
                    'gameStats',
                    { data: period.data },
                    { actor: { id: 'synthetic-admin', roles: ['admin'] } },
                ),
            ).rejects.toThrow()
            const dates = {
                game: game.id,
                periodKey: 'timezone',
                period: 'Timezone test',
                order: 2,
                values: [],
                start: '2026-10-16T12:00:00+09:00',
                end: '2026-10-16T04:00:00Z',
            }
            expect((await config.models.gameStats.validate.safeParseAsync(dates)).success).toBe(
                true,
            )
            expect(
                (
                    await config.models.gameStats.validate.safeParseAsync({
                        ...dates,
                        end: '2026-10-16T02:00:00Z',
                    })
                ).success,
            ).toBe(false)
            const changed = await admin.updateEntry(
                game.id,
                {
                    expectedVersion: game.version,
                    data: {
                        ...game.data,
                        metrics: metrics.map((metric) =>
                            metric.key === 'peakRank'
                                ? {
                                      ...metric,
                                      positions: [
                                          { value: 2150, label: 'New boundary', color: '#22AA66' },
                                      ],
                                  }
                                : metric,
                        ),
                    },
                },
                undefined,
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            expect((await admin.getEntry(period.id)).data.values).toContainEqual({
                key: 'peakRank',
                value: 2123,
                label: 'Immortal 1 23 RR',
                color: '#EF4444',
            })
            await expect(
                admin.updateEntry(
                    game.id,
                    {
                        expectedVersion: changed.version,
                        data: {
                            ...changed.data,
                            metrics: metrics.filter((metric) => metric.key !== 'peakRank'),
                        },
                    },
                    undefined,
                    { actor: { id: 'synthetic-admin', roles: ['admin'] } },
                ),
            ).rejects.toThrow()
            let post = await admin.createEntry(
                'posts',
                {
                    data: {
                        title: '<game:valorant> today',
                        content: 'Play <game:valorant>\n\n<!-- more -->\n\nMore',
                        tags: [],
                        slug: 'mention-post',
                    },
                    translations: {
                        en: { title: 'No mentions', content: 'Nothing here', slug: 'english-post' },
                    },
                },
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            expect(post.data.plainTitle).toBe('VALORANT today')
            expect(post.data.gameMentions).toEqual([game.id])
            expect(post.translations.en).toMatchObject({
                plainTitle: 'No mentions',
                gameMentions: [],
            })
            post = await admin.publishEntry(post.id, { expectedVersion: post.version }, undefined, {
                actor: { id: 'synthetic-admin', roles: ['admin'] },
            })
            await admin.updateEntry(
                post.id,
                {
                    expectedVersion: post.version,
                    data: { ...post.data, title: 'Draft only', content: 'No mentions' },
                },
                undefined,
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            const client = createLitiClient({
                origin: 'http://synthetic.invalid',
                publicBaseURL: '/api/content',
                fetch: (input, init) =>
                    handlePublicRequest(admin, new Request(String(input), init)),
            })
            const published = await client.query('posts', { mode: 'one', id: post.id })
            expect(published?.data.plainTitle).toBe('VALORANT today')
            expect(published?.seo.title).toBe('VALORANT today')
            expect(published?.data.gameMentions).toHaveLength(1)
            let automatic = await admin.createEntry(
                'posts',
                {
                    data: {
                        title: 'Automatic summary',
                        content: '<game:valorant>',
                        tags: [],
                        slug: 'automatic-summary',
                    },
                },
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            automatic = await admin.publishEntry(
                automatic.id,
                {
                    expectedVersion: automatic.version,
                },
                undefined,
                { actor: { id: 'synthetic-admin', roles: ['admin'] } },
            )
            const summaries = await client.query('posts', { markdown: 'summary' })
            expect(
                JSON.stringify(summaries.find((entry) => entry.id === automatic.id)?.data.content),
            ).toContain('game-mention')
            const summary = (await client.query('posts', { markdown: 'summary' }))[0]!
            expect(JSON.stringify(summary.data.content)).toContain('game-mention')
        })
    } finally {
        local.close()
    }
})

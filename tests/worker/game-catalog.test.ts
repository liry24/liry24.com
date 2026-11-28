import { expect, test } from 'vitest'
import { z } from 'zod'

import type { GameRecordData, GameStatsRecordData, PostData } from '../../shared/types/content'
import { gameFieldsSchema } from '../../shared/utils/contentSchemas'
import { builtWorker } from '../helpers/builtWorker'
import { seedGameCatalog } from '../helpers/workerSeed'

type WritePayload =
    | {
          id?: string
          data:
              | GameRecordData
              | GameStatsRecordData
              | (Omit<GameStatsRecordData, 'game' | 'periodKey' | 'order'> & {
                    game?: string
                    periodKey?: string
                    order?: number
                })
              | Pick<PostData, 'slug' | 'title'>
          body?: string
          gameConfig?: {
              igdbId: number
              primaryMetric?: string
              metrics: GameRecordData['metrics']
          }
          mentionedGames?: Array<{ slug: string; igdbId: number }>
      }
    | { id: string; action: 'publish'; collection: 'gameStats' | 'posts' }

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the live game catalog supplies stats and mentions while public APIs expose only display data',
    async () => {
        const app = await builtWorker()
        try {
            const admin = await app.session('catalog-admin')
            const fetch = app.server.fetch.bind(app.server)
            const post = (path: string, body: WritePayload) =>
                fetch(path, {
                    method: 'POST',
                    headers: { ...admin, 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })
            const gameId = 'igdb-126459'
            const game = gameFieldsSchema.parse({
                igdbId: 126_459,
                slug: 'valorant',
                name: 'Valorant',
            })
            await seedGameCatalog(app.env.DB, gameId, game)

            expect((await fetch('/api/admin/games/catalog')).status).toBe(401)
            const mention = '/api/posts/game-mentions/valorant'
            expect(await (await fetch(mention)).json()).toEqual({
                slug: 'valorant',
                name: 'Valorant',
            })
            expect(await (await fetch('/api/portfolio/gameStats')).json()).toEqual({
                items: [],
                total: 0,
                games: [],
            })

            const configured: GameRecordData = {
                ...game,
                primaryMetric: 'rank',
                metrics: [{ key: 'rank', label: 'Rank', format: 'integer', positions: [] }],
            }
            const edited = await post('/_vitehub/forms/game', { id: gameId, data: configured })
            expect(edited.status, await edited.text()).toBe(200)
            const catalog = await fetch('/api/admin/games/catalog', { headers: admin })
            expect(await catalog.json()).toEqual({ items: [{ id: gameId, data: configured }] })

            const stat = {
                game: gameId,
                periodKey: 'v25a6',
                period: 'V25A6',
                order: 0,
                href: 'https://example.com/profile',
                values: [
                    {
                        key: 'rank',
                        value: 22,
                        label: 'Immortal 1',
                        image: { pathname: 'rank-badge.png' },
                    },
                ],
            }
            const statsId = 'igdb-126459-v25a6'
            const saved = await post('/_vitehub/forms/game-stats', { id: statsId, data: stat })
            expect(saved.status, await saved.text()).toBe(201)
            const published = await post('/api/admin/content/publish', {
                action: 'publish',
                collection: 'gameStats',
                id: statsId,
            })
            expect(published.status, await published.text()).toBe(200)
            expect(await (await fetch('/api/portfolio/gameStats')).json()).toEqual({
                items: [{ id: statsId, data: stat }],
                total: 1,
                games: [
                    {
                        id: gameId,
                        data: {
                            slug: game.slug,
                            name: game.name,
                            primaryMetric: 'rank',
                            metrics: configured.metrics,
                        },
                    },
                ],
            })
            const savedPost = await post('/_vitehub/forms/post', {
                id: 'catalog-post',
                data: { slug: 'catalog-post', title: 'A <game:valorant> post' },
                body: 'About <game:valorant>.',
            })
            expect(savedPost.status, await savedPost.text()).toBe(201)
            const publishedPost = await post('/api/admin/content/publish', {
                action: 'publish',
                collection: 'posts',
                id: 'catalog-post',
            })
            expect(publishedPost.status, await publishedPost.text()).toBe(200)
            expect(await (await fetch('/api/posts/cards?game=valorant')).json()).toMatchObject({
                items: [{ id: 'catalog-post' }],
            })

            const deleteGame = await fetch(`/api/admin/games/${gameId}`, {
                method: 'DELETE',
                headers: admin,
            })
            expect(deleteGame.status).toBe(409)
        } finally {
            await app.close()
        }
    },
    120_000,
)

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'game stats and post mentions auto-register games on save via the IGDB emulator without leaking failed drafts',
    async () => {
        const app = await builtWorker({ env: { LIRY24_IGDB_EMULATOR: 'true' } })
        try {
            const admin = await app.session('emulator-admin')
            const fetch = app.server.fetch.bind(app.server)
            const post = (path: string, body: WritePayload) =>
                fetch(path, {
                    method: 'POST',
                    headers: { ...admin, 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })

            // /admin/games redirects to /admin/gameStats
            const legacyRoute = await fetch('/admin/games', {
                headers: admin,
                redirect: 'manual',
            })
            expect([301, 302, 307, 308]).toContain(legacyRoute.status)
            expect(legacyRoute.headers.get('location')).toBe('/admin/gameStats')

            // Invalid stat submission for an unregistered game must NOT insert into game_catalog
            const invalidStat = await post('/_vitehub/forms/game-stats', {
                data: {
                    period: 'Act 0',
                    values: [{ key: 'mr', value: 1.5 }],
                },
                gameConfig: {
                    igdbId: 119_133, // Elden Ring
                    primaryMetric: 'mr',
                    metrics: [{ key: 'mr', label: 'MR', format: 'integer', positions: [] }],
                },
            })
            expect(invalidStat.status).toBe(400)
            expect(
                await (await fetch('/api/admin/games/catalog', { headers: admin })).json(),
            ).toEqual({ items: [] })

            // Valid stat submission auto-registers Street Fighter 6 + metrics + stat in one request
            const createdStat = await post('/_vitehub/forms/game-stats', {
                data: {
                    period: 'Act 5',
                    values: [{ key: 'master_rate', value: 1700, label: '1700 MR' }],
                },
                gameConfig: {
                    igdbId: 191_692, // Street Fighter 6
                    primaryMetric: 'master_rate',
                    metrics: [
                        {
                            key: 'master_rate',
                            label: 'Master Rate',
                            format: 'integer',
                            unit: 'MR',
                            positions: [{ value: 1500, label: 'Master', color: '#2563EB' }],
                        },
                    ],
                },
            })
            expect(createdStat.status, await createdStat.clone().text()).toBe(201)
            const statResult = z
                .object({ id: z.string(), gameId: z.string() })
                .parse(await createdStat.json())
            expect(statResult.gameId).toBe('igdb-191692')

            // Solo unpublished draft allows editing metric format before publishing
            const editedMetricFormat = await post('/_vitehub/forms/game-stats', {
                id: statResult.id,
                data: {
                    period: 'Act 5',
                    values: [{ key: 'master_rate', value: 1700.5 }],
                },
                gameConfig: {
                    igdbId: 191_692,
                    primaryMetric: 'master_rate',
                    metrics: [
                        {
                            key: 'master_rate',
                            label: 'Master Rate',
                            format: 'decimal',
                            unit: 'MR',
                            positions: [],
                        },
                    ],
                },
            })
            expect(editedMetricFormat.status, await editedMetricFormat.text()).toBe(201)

            // Post validation failure (empty title) must NOT register mentioned game
            const invalidPost = await post('/_vitehub/forms/post', {
                data: { slug: 'bad-post', title: '' },
                body: 'Playing :game[elden-ring].',
                mentionedGames: [{ slug: 'elden-ring', igdbId: 119_133 }],
            })
            expect(invalidPost.status).toBe(400)
            const afterInvalidPost = z
                .object({ items: z.array(z.object({ id: z.string() })) })
                .parse(await (await fetch('/api/admin/games/catalog', { headers: admin })).json())
            expect(afterInvalidPost.items.map((item) => item.id)).toEqual(['igdb-191692'])

            // Valid post auto-registers unregistered mention :game[elden-ring] on save
            const savedPost = await post('/_vitehub/forms/post', {
                id: 'elden-review',
                data: { slug: 'elden-review', title: 'Reviewing :game[elden-ring]' },
                body: 'Spent 100 hours in :game[elden-ring].',
                mentionedGames: [{ slug: 'elden-ring', igdbId: 119_133 }],
            })
            expect(savedPost.status, await savedPost.text()).toBe(201)

            // Catalog ?meta=1 reports postCount and draft metric usage accurately
            const withMeta = z
                .object({
                    items: z.array(z.object({ id: z.string() })),
                    meta: z.record(
                        z.string(),
                        z.object({
                            postCount: z.number(),
                            publishedMetricKeys: z.array(z.string()),
                            draftMetricStatIds: z.record(z.string(), z.array(z.string())),
                        }),
                    ),
                })
                .parse(
                    await (
                        await fetch('/api/admin/games/catalog?meta=1', { headers: admin })
                    ).json(),
                )
            expect(withMeta.items.map((item) => item.id)).toEqual(['igdb-191692', 'igdb-119133'])
            expect(withMeta.meta['igdb-119133']).toEqual({
                postCount: 1,
                publishedMetricKeys: [],
                draftMetricStatIds: {},
            })
            expect(withMeta.meta['igdb-191692']).toEqual({
                postCount: 0,
                publishedMetricKeys: [],
                draftMetricStatIds: { master_rate: [statResult.id] },
            })

            // Publishing locks the metric format against destructive changes
            const publishedStat = await post('/api/admin/content/publish', {
                action: 'publish',
                collection: 'gameStats',
                id: statResult.id,
            })
            expect(publishedStat.status).toBe(200)

            const blockedFormatChange = await post('/_vitehub/forms/game-stats', {
                id: statResult.id,
                data: {
                    period: 'Act 5',
                    values: [{ key: 'master_rate', value: 1700 }],
                },
                gameConfig: {
                    igdbId: 191_692,
                    primaryMetric: 'master_rate',
                    metrics: [
                        {
                            key: 'master_rate',
                            label: 'Master Rate',
                            format: 'integer',
                            unit: 'MR',
                            positions: [],
                        },
                    ],
                },
            })
            expect(blockedFormatChange.status).toBe(400)
        } finally {
            await app.close()
        }
    },
    120_000,
)

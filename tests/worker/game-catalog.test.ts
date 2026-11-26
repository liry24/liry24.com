import { expect, test } from 'vitest'

import type { GameRecordData, GameStatsRecordData, PostData } from '../../shared/types/content'
import { gameFieldsSchema } from '../../shared/utils/contentSchemas'
import { builtWorker } from '../helpers/builtWorker'
import { seedGameCatalog } from '../helpers/workerSeed'

type WritePayload =
    | {
          id: string
          data: GameRecordData | GameStatsRecordData | Pick<PostData, 'slug' | 'title'>
          body?: string
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

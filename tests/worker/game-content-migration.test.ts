import { expect, test } from 'vitest'

import { builtWorker } from '../helpers/builtWorker'

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'the transition Worker copies Games and replaces the public rank without changing the card',
    async () => {
        const app = await builtWorker()
        try {
            const admin = await app.session('migration-admin')
            const headers = { ...admin, 'content-type': 'application/json' }
            const post = (path: string, body: object) =>
                app.server.fetch(path, { method: 'POST', body: JSON.stringify(body), headers })
            const saveAndPublish = async (
                form: string,
                collection: string,
                id: string,
                data: object,
            ) => {
                const saved = await post(`/_vitehub/forms/${form}`, { id, data })
                expect(saved.status, await saved.text()).toBe(201)
                const published = await post('/api/admin/content/publish', {
                    action: 'publish',
                    collection,
                    id,
                })
                expect(published.status, await published.text()).toBe(200)
            }
            await saveAndPublish('game', 'games', 'igdb-126459', {
                igdbId: 126459,
                slug: 'valorant',
                name: 'Valorant',
            })
            const href = 'https://example.com/profile'
            await saveAndPublish('rank', 'ranks', 'legacy-ranks-1', {
                game: 'VALORANT',
                rank: 'Immortal 1',
                season: 'V25A6',
                href,
                image: { pathname: 'ranks/immortal.png', contentType: 'image/png' },
            })
            const draft = await post('/_vitehub/forms/game', {
                id: 'igdb-123',
                data: { igdbId: 123, slug: 'draft-game', name: 'Draft game' },
            })
            expect(draft.status, await draft.text()).toBe(201)

            const migrate = (action: string) =>
                post('/api/admin/migrations/game-content', { action })
            expect((await migrate('retire')).status).toBe(409)
            for (const action of ['inspect', 'copy', 'copy', 'retire', 'retire']) {
                const response = await migrate(action)
                expect(response.status, `${action}: ${await response.text()}`).toBe(200)
            }
            const rows = await app.env.DB.prepare('SELECT id FROM game_catalog ORDER BY id').all()
            expect(rows.results).toEqual([{ id: 'igdb-123' }, { id: 'igdb-126459' }])
            expect(await (await app.server.fetch('/api/portfolio/ranks')).json()).toMatchObject({
                total: 0,
            })
            expect(await (await app.server.fetch('/api/portfolio/gameStats')).json()).toMatchObject(
                {
                    total: 1,
                    items: [
                        {
                            id: 'igdb-126459-v25a6',
                            data: {
                                game: 'igdb-126459',
                                period: 'V25A6',
                                href,
                                values: [{ label: 'Immortal 1' }],
                            },
                        },
                    ],
                },
            )
            expect(await (await app.server.fetch('/')).text()).toContain('alt="Immortal 1"')
        } finally {
            await app.close()
        }
    },
    120_000,
)

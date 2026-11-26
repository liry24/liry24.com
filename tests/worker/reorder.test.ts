import { expect, test } from 'vitest'
import { z } from 'zod'

import { gameFieldsSchema } from '../../shared/utils/contentSchemas'
import { builtWorker } from '../helpers/builtWorker'
import { seedGameCatalog } from '../helpers/workerSeed'

const orderedList = z.object({
    items: z.array(
        z.object({
            id: z.string(),
            data: z.object({ name: z.string(), order: z.number() }),
        }),
    ),
})

type RequestBody =
    | { model: string; from: Array<string>; to: Array<string> }
    | { action: 'publish' | 'schedule'; collection: 'skills'; id: string; at?: string }
    | {
          id: string
          data: { name: string; slug?: string; icon?: string; igdbId?: number; order?: number }
      }

test.runIf(process.env.LIRY24_TEST_BUILT_WORKER === 'true')(
    'reorders content drafts and the game catalog while protecting current order and scheduled drafts',
    async () => {
        const app = await builtWorker()
        try {
            const admin = await app.session('reorder-admin')
            const user = await app.session('reorder-user', 'user')
            const post = (path: string, body: RequestBody, session = admin) =>
                app.server.fetch(path, {
                    method: 'POST',
                    headers: { ...session, 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })
            const reorder = (
                model: string,
                from: Array<string>,
                to: Array<string>,
                session = admin,
            ) => post('/api/admin/reorder', { model, from, to }, session)
            const list = async (path: string) => {
                const response = await app.server.fetch(path, { headers: admin })
                expect(response.status).toBe(200)
                return orderedList.parse(await response.json()).items
            }
            const skillsPath = '/api/admin/content/skills'
            const portfolioPath = '/api/portfolio/skills'
            const gamesPath = '/api/admin/games/catalog'
            const original = ['alpha', 'beta', 'gamma']
            const reordered = ['gamma', 'beta', 'alpha']
            const skill = (id: string, name: string, order?: number) =>
                post('/_vitehub/forms/skill', {
                    id,
                    data: { name, icon: 'lucide:star', order },
                })

            for (const [index, id] of original.entries()) {
                expect((await skill(id, id, index === 2 ? 12 : 5)).status).toBe(201)
                expect(
                    (
                        await post('/api/admin/content/publish', {
                            action: 'publish',
                            collection: 'skills',
                            id,
                        })
                    ).status,
                ).toBe(200)
            }
            expect((await reorder('skills', original, reordered, user)).status).toBe(403)
            expect((await reorder('skills', original, ['alpha', 'alpha', 'gamma'])).status).toBe(
                400,
            )
            const saved = await reorder('skills', original, reordered)
            expect(saved.status, await saved.text()).toBe(200)
            expect((await list(skillsPath)).map(({ id }) => id)).toEqual(reordered)
            expect((await list(portfolioPath)).map(({ id }) => id)).toEqual(original)
            expect((await reorder('skills', original, reordered)).status).toBe(200)
            expect((await reorder('skills', original, ['beta', 'alpha', 'gamma'])).status).toBe(409)

            expect((await skill('alpha', 'Edited Alpha')).status).toBe(201)
            expect((await skill('delta', 'New Skill')).status).toBe(201)
            expect(await list(skillsPath)).toMatchObject([
                { id: 'gamma', data: { order: 0 } },
                { id: 'beta', data: { order: 1 } },
                { id: 'alpha', data: { name: 'Edited Alpha', order: 2 } },
                { id: 'delta', data: { order: 3 } },
            ])
            const schedule = await post('/api/admin/content/publish', {
                action: 'schedule',
                collection: 'skills',
                id: 'alpha',
                at: new Date(Date.now() + 86_400_000).toISOString(),
            })
            expect(schedule.status, await schedule.text()).toBe(200)
            const withNewItem = [...reordered, 'delta']
            expect((await reorder('skills', withNewItem, [...original, 'delta'])).status).toBe(409)
            expect((await list(skillsPath)).map(({ id }) => id)).toEqual(withNewItem)

            for (const [index, name] of original.entries()) {
                const igdbId = index + 1
                const game = gameFieldsSchema.parse({ igdbId, slug: name, name, order: index * 2 })
                await seedGameCatalog(app.env.DB, name, game)
            }
            const alternative = ['beta', 'gamma', 'alpha']
            const competing = await Promise.all([
                reorder('games', original, reordered),
                reorder('games', original, alternative),
            ])
            expect(competing.map((response) => response.status).sort((a, b) => a - b)).toEqual([
                200, 409,
            ])
            const games = await list(gamesPath)
            const winner = competing[0]?.status === 200 ? reordered : alternative
            expect(games.map(({ id, data }) => [id, data.name, data.order])).toEqual(
                winner.map((id, index) => [id, id, index * 2]),
            )
            const savedGame = await post('/_vitehub/forms/game', {
                id: 'alpha',
                data: { igdbId: 1, slug: 'alpha', name: 'alpha' },
            })
            expect(savedGame.status, await savedGame.text()).toBe(200)
            expect(await list(gamesPath)).toEqual(games)
        } finally {
            await app.close()
        }
    },
    60_000,
)

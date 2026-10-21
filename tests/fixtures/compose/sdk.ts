import type { RequestEvent } from 'nuxt/schema'

import { configureGameFixture, createGame, game, savedGame } from './games'
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const getNitroRequest = (event: RequestEvent) => event.req
export function useAdmin(event: RequestEvent) {
    const scenario = event.req.headers.get('x-fixture-case')
    configureGameFixture(scenario)
    return {
        async models() {
            await delay(15)
            return composerModels
                .filter((name) => scenario !== 'socials-only' || name === 'socials')
                .map((name) => ({
                    name,
                    meta: { label: name },
                    displayFields: { title: 'title' },
                    features: { publishing: true, scheduling: true },
                    fields: { title: { kind: 'text', required: true } },
                }))
        },
        entries: {
            create: createGame,
            async list(model: string) {
                if (model === 'games') return { items: [{ id: 'igdb-1', data: game }], total: 1 }
                const fails = scenario === 'lookup-failure' && model === 'works'
                await delay(fails ? 40 : 100)
                if (fails) throw new Error('Synthetic lookup failure')
                return { items: [], total: 0 }
            },
            async get(_model: string, id: string) {
                if (_model === 'games') {
                    const found = await savedGame()
                    if (!found)
                        throw Object.assign(new Error('Not found'), {
                            code: 'LITI_ENTRY_NOT_FOUND',
                        })
                    return found
                }
                await delay(30)
                return { id, data: { title: 'Old' } }
            },
        },
    }
}

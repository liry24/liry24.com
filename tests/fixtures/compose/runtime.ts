import { describeModel, type Actor } from '@litijs/model'

import * as content from '../../../server/models/content'
import * as records from '../../../server/models/records'
import { configureGameFixture, createGame, savedGame } from './games'

const definitions = new Map(
    [...Object.values(content), ...Object.values(records)].map((model) => [model.name, model]),
)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let scenario: unknown
const runtime = {
    definition: (name: string) => {
        const model = definitions.get(name)
        if (!model) throw new Error('Unknown fixture model')
        return model
    },
    async descriptors(actor: Actor) {
        scenario = actor.scenario
        configureGameFixture(typeof scenario === 'string' ? scenario : null)
        await delay(15)
        return [...definitions.values()]
            .filter((model) => scenario !== 'socials-only' || model.name === 'socials')
            .map((model) => describeModel(model, 'management'))
    },
    nativeContent: {
        collection: (name: string) => ({
            list: async () => {
                const fails = scenario === 'lookup-failure' && name === 'works'
                await delay(fails ? 40 : 100)
                if (fails) throw Error('Synthetic lookup failure')
                return { items: [] }
            },
        }),
    },
    content: {
        readDraft: async (_model: string, id: string) => {
            await delay(30)
            return { id, data: { title: 'Old' } }
        },
    },
    records: {
        query: async () => {
            await delay(100)
            return { items: [], total: 0 }
        },
        readDraft: async (_model: string, _id: string, operation: { actor: Actor }) => {
            if (scenario !== operation.actor.scenario) {
                scenario = operation.actor.scenario
                configureGameFixture(typeof scenario === 'string' ? scenario : null)
            }
            return await savedGame()
        },
        save: async (name: string, id: string, data: Record<string, unknown>) => {
            await createGame(name, { id, data })
            return { id, version: 1 }
        },
    },
}
export default runtime

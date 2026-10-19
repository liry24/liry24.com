import type { RequestEvent } from 'nuxt/schema'

import { composerModels } from '../../../shared/utils/adminComposer'
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const getNitroRequest = (event: RequestEvent) => event.req
export function useAdmin(event: RequestEvent) {
    const scenario = event.req.headers.get('x-fixture-case')
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
            async list(model: string) {
                const fails = scenario === 'lookup-failure' && model === 'works'
                await delay(fails ? 40 : 100)
                if (fails) throw new Error('Synthetic lookup failure')
                return { items: [], total: 0 }
            },
            async get(_model: string, id: string) {
                await delay(30)
                return { id, data: { title: 'Old' } }
            },
        },
    }
}

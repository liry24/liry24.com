import { ai } from '../../evaluator'

export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook('request', (event) => {
        event.context.cloudflare = { env: { AI: ai } }
    })
})

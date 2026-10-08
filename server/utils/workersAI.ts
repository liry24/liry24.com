import type { SiteAdminAIModelContext } from '@liria24/site-admin/ai'
import { createWorkersAI } from 'workers-ai-provider'

import { getCloudflareEnvironment } from './cloudflareContext'

export const postAIModel = 'openai/gpt-6-luna'

export const getWorkersAIModel = ({ platformContext }: SiteAdminAIModelContext) => {
    const { AI } = getCloudflareEnvironment<{
        AI?: Parameters<typeof createWorkersAI>[0]['binding']
    }>(undefined, platformContext)
    if (!AI || typeof AI.run !== 'function')
        throw new Error('Cloudflare Workers AI binding is not configured.')
    // Provider 3.0.0 forwards directly to this binding; newer catalog routing defaults
    // to an AI Gateway for openai/* IDs. Keep the pin until direct routing is supported.
    // Resolve the current binding per operation; never retain a request in a cached model.
    const provider = createWorkersAI({ binding: AI })
    // The pinned provider's model-name union predates this requested ID. Runtime
    // acceptance remains the binding's responsibility, without selecting a fallback.
    return provider(postAIModel as Parameters<typeof provider>[0])
}

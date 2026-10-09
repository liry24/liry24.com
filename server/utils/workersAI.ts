import type { SiteAdminAIModelContext } from '@liria24/site-admin/ai'
import { createWorkersAI } from 'workers-ai-provider'
import { openai } from 'workers-ai-provider/openai'

import { getCloudflareEnvironment } from './cloudflareContext.ts'

export const postAIModel = 'openai/gpt-6-luna'

export const getWorkersAIModel = ({ platformContext }: SiteAdminAIModelContext) => {
    const { AI } = getCloudflareEnvironment<{
        AI?: Parameters<typeof createWorkersAI>[0]['binding']
    }>(undefined, platformContext)
    if (!AI || typeof AI.run !== 'function')
        throw new Error('Cloudflare Workers AI binding is not configured.')
    // Resolve the current binding per operation; never retain a request in a cached model.
    return createWorkersAI({ binding: AI, providers: [openai], resume: false })(postAIModel)
}

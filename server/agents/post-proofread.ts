import { proofreadingAgent } from '@litijs/blog/agents'

import { postEditorialModel } from '../utils/postEditorialModel.ts'

export default proofreadingAgent({ model: postEditorialModel })

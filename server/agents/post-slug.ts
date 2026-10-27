import { slugAgent } from '@litijs/blog/agents'

import { postEditorialModel } from '../utils/postEditorialModel.ts'

export default slugAgent({ model: postEditorialModel })

import { defineDatabase } from 'vite-hub/database'

import { gameCatalog, postSlugs } from './schema.js'

export default defineDatabase({ schema: { gameCatalog, postSlugs } })

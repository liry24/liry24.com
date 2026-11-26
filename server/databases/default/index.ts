import { defineDatabase } from 'vite-hub/database'

import { gameCatalog } from './schema.js'

export default defineDatabase({ schema: { gameCatalog } })

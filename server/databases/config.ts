import { defineDatabase } from 'vite-hub/database'

import * as schema from '../database/auth-schema'

export default defineDatabase({ schema })

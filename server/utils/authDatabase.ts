import { drizzleAdapter as authAdapter } from '@better-auth/drizzle-adapter/relations-v2'

import type { Database } from '../database/index.ts'
import * as schema from '../database/schema.ts'
import { useDB } from './database.ts'

const adapters = new WeakMap<Database, ReturnType<typeof authAdapter>>()

// Site Admin prepares its database hook before Better Auth only when the config
// has no direct database adapter. This app owns that adapter, so auth resolves it here.
export const createAuthDatabase = (
    event?: Parameters<typeof useDB>[0],
    platformContext?: object,
) => {
    const database = useDB(event, platformContext)
    let adapter = adapters.get(database)
    if (!adapter) {
        adapter = authAdapter(database, {
            provider: 'sqlite',
            schema,
            transaction: false,
            usePlural: true,
        })
        adapters.set(database, adapter)
    }
    return adapter
}

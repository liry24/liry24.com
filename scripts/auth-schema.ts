import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'

import auth from '../server/auth.config.ts'

export default (context: Parameters<typeof auth>[0]) => ({
    ...auth(context),
    database: drizzleAdapter(undefined as never, {
        provider: 'sqlite',
        usePlural: true,
        transaction: false,
    }),
})

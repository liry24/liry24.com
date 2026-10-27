import { betterAuth } from 'better-auth'

import { createAuthOptions } from './server/utils/authOptions'

// Schema generation is offline and never opens the application database.
export const auth = betterAuth({
    ...createAuthOptions(),
    secret: 'schema-only-synthetic-key-0123456789abcdef',
})

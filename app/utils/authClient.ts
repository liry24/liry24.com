import { passkeyClient } from '@better-auth/passkey/client'
import { adminClient, lastLoginMethodClient, usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'vite-hub/auth/vue'

export const authClient = createAuthClient({
    plugins: [
        passkeyClient(),
        adminClient({ ac: adminAccess, roles: adminRoles }),
        lastLoginMethodClient(),
        usernameClient(),
    ],
})

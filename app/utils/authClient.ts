import { adminClient, usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'vite-hub/auth/vue'

export const authClient = createAuthClient({
    plugins: [adminClient({ ac: adminAccess, roles: adminRoles }), usernameClient()],
})

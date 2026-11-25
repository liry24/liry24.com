import { adminClient } from 'better-auth/client/plugins'
import { defineAuthClient } from 'vite-hub/auth/vue'

export default defineAuthClient({
    plugins: [adminClient()],
})

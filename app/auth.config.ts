import { passkeyClient } from '@better-auth/passkey/client'

import { lastLoginMethodClient } from '#better-auth/client/plugins'
import { defineClientAuth } from '#nuxtjs/better-auth/config'

export default defineClientAuth({ plugins: [passkeyClient(), lastLoginMethodClient()] })

import { passkeyClient } from '@better-auth/passkey/client'
import { defineClientAuth } from '@nuxtjs/better-auth/config'
import { lastLoginMethodClient } from 'better-auth/client/plugins'

export default defineClientAuth({ plugins: [passkeyClient(), lastLoginMethodClient()] })

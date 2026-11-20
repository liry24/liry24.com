import { expect, test, vi } from 'vitest'

import { createAuthOptions } from '../server/utils/authOptions'

test('dev and production both provision ordinary users and require Pocket ID', () => {
    try {
        for (const environment of ['dev', 'production']) {
            vi.stubEnv('APP_ENV', environment)
            const options = createAuthOptions()
            expect(options.account.accountLinking).toMatchObject({
                enabled: false,
                disableImplicitLinking: true,
            })
            expect(options.plugins.map((plugin) => plugin.id)).toContain('generic-oauth')
            expect(options.plugins.map((plugin) => plugin.id)).not.toContain('passkey')
            expect(options).not.toHaveProperty('socialProviders')
            expect(options).not.toHaveProperty('databaseHooks')
            expect(options.advanced.cookiePrefix).toBe('liry24-pocket')
        }
    } finally {
        vi.unstubAllEnvs()
    }
})

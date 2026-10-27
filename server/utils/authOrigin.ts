import { createError } from 'nuxt/server'
import { assertAuthOrigin } from 'vite-hub/auth/server'

export async function assertAppOrigin(request: Request) {
    try {
        await assertAuthOrigin(request)
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            ['AUTH_R0006', 'AUTH_R0007'].includes(String(error.code))
        )
            throw createError({ status: 403, statusText: 'Access denied', cause: error })
        throw error
    }
}

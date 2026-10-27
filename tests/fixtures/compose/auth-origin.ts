import { createError } from 'nuxt/server'

// This synthetic HTTP fixture mocks Auth; the built Worker tests exercise native CSRF/session checks.
export function assertAuthOrigin(request: Request) {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) throw createError({ status: 403 })
}

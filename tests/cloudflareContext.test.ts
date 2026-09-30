import { describe, expect, test } from 'bun:test'

import type { H3Event } from 'h3'

const { attachCloudflareContext, getCloudflareEnvironment } =
    await import('../server/utils/cloudflareContext')

describe('Cloudflare module-worker request context', () => {
    const readDatabase = (event: H3Event) => getCloudflareEnvironment<{ DB: unknown }>(event).DB

    test('lets a consumer read bindings in the development preset', () => {
        const event = {
            context: { cloudflare: { env: { DB: 'development-binding' } } },
        } as unknown as H3Event

        expect(readDatabase(event)).toBe('development-binding')
    })

    test('lets a consumer read bindings in the module-worker preset', () => {
        const cloudflare = {
            request: new Request('https://liry24.test/api/works'),
            env: { DB: 'module-worker-binding' },
            context: { waitUntil: (_promise: Promise<unknown>) => undefined },
        }
        const event = {
            context: {
                _platform: {
                    cloudflare,
                },
            },
        } as unknown as H3Event

        attachCloudflareContext(event)

        expect(readDatabase(event)).toBe('module-worker-binding')
    })
})

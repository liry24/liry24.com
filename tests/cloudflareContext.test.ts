import type { H3Event } from 'h3'
import { describe, expect, test } from 'vitest'

import { getCloudflareEnvironment } from '../server/utils/cloudflareContext'

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

        expect(readDatabase(event)).toBe('module-worker-binding')
    })

    test('prefers the request binding without changing its context', () => {
        const event = {
            context: {
                cloudflare: { env: { DB: 'request-binding' } },
                _platform: { cloudflare: { env: { DB: 'platform-binding' } } },
            },
        } as unknown as H3Event
        Object.freeze(event.context)
        expect(readDatabase(event)).toBe('request-binding')
    })

    test('uses runtime bindings for scheduled tasks and events without platform context', () => {
        expect(getCloudflareEnvironment()).toBe(process.env)
        expect(getCloudflareEnvironment({ context: {} } as H3Event)).toBe(process.env)
    })

    test('uses each explicit task binding instead of retaining the previous task context', () => {
        const first = { env: { DB: 'first-task' } }
        const second = { env: { DB: 'second-task' } }
        expect(getCloudflareEnvironment<{ DB: string }>(undefined, first).DB).toBe('first-task')
        expect(getCloudflareEnvironment<{ DB: string }>(undefined, second).DB).toBe('second-task')
        expect(getCloudflareEnvironment<{ DB: string }>(undefined, first).DB).toBe('first-task')
    })
})

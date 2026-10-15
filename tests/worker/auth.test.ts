import { DatabaseSync } from 'node:sqlite'

import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth'
import { createAuthEndpoint } from 'better-auth/api'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { expect, test } from 'vitest'

import * as schema from '../../server/database/schema'

test('auth counters bound unknown paths and dynamic routes while preserving ingress rules', async () => {
    const db = new DatabaseSync(':memory:')
    try {
        for (const migration of readMigrationFiles({ migrationsFolder: 'drizzle' }))
            db.exec(migration.sql.join(';'))
        const auth = betterAuth({
            baseURL: 'https://auth.invalid',
            secret: 'test-only-auth-secret-not-for-deployment',
            database: drizzleAdapter(drizzle({ client: db, relations: schema.authRelations }), {
                provider: 'sqlite',
                schema,
                usePlural: true,
                transaction: false,
            }),
            rateLimit: {
                enabled: true,
                storage: 'database',
                window: 60,
                max: 3,
                customRules: {
                    '/get-session': { window: 60, max: 4 },
                    '/probe/strict': { window: 60, max: 1 },
                },
            },
            advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
            plugins: [
                {
                    id: 'route-probe',
                    endpoints: {
                        probe: createAuthEndpoint('/probe/:id', { method: 'GET' }, async (ctx) =>
                            ctx.json({ id: ctx.params.id }),
                        ),
                    },
                    onRequest: async (req) => {
                        if (new URL(req.url).pathname.startsWith('/api/auth/rewrite-'))
                            return {
                                request: new Request(
                                    'https://auth.invalid/api/auth/probe/rewritten',
                                    req,
                                ),
                            }
                        if (new URL(req.url).pathname.startsWith('/api/auth/early-'))
                            return { response: new Response('early') }
                    },
                },
            ],
        })
        const request = (path: string, ip = '198.51.100.20', method = 'GET') =>
            auth.handler(
                new Request(`https://auth.invalid/api/auth${path}`, {
                    method,
                    headers: { 'cf-connecting-ip': ip },
                }),
            )
        for (const path of ['/missing-a', '/missing-b?x=1', '/%67et-session'])
            expect((await request(path)).status).toBe(404)
        expect(db.prepare('SELECT COUNT(*) n FROM rate_limits').get()?.n).toBe(1)
        expect((await request('/missing-c')).status).toBe(429)
        expect((await request('/missing-c', '198.51.100.21')).status).toBe(404)

        for (const path of ['/probe/a', '/probe/a%2Fb', '/probe/%41?x=1'])
            expect((await request(path)).status).toBe(200)
        expect((await request('/probe/next')).status).toBe(429)
        expect((await request('/probe/strict')).status).toBe(429)
        expect(db.prepare('SELECT COUNT(*) n FROM rate_limits').get()?.n).toBe(3)
        for (let i = 0; i < 4; i++) expect((await request('/get-session')).status).toBe(200)
        expect((await request('/get-session')).status).toBe(429)

        for (const [path, method] of [
            ['/probe/id', 'HEAD'],
            ['/probe//id', 'GET'],
            ['/probe/id/', 'GET'],
        ])
            expect((await request(path!, '198.51.100.22', method!)).status).toBe(404)
        expect((await request('/rewrite-first', '198.51.100.23')).status).toBe(200)
        expect((await request('/early-second', '198.51.100.23')).status).toBe(200)
        expect((await request('/rewrite-third', '198.51.100.23')).status).toBe(200)
        expect((await request('/early-fourth', '198.51.100.23')).status).toBe(429)
        expect(
            db.prepare('SELECT COUNT(*) n FROM rate_limits WHERE key LIKE ?').get('198.51.100.23|%')
                ?.n,
        ).toBe(1)
        db.exec('UPDATE rate_limits SET last_request = 0')
        expect((await request('/missing-after-expiry')).status).toBe(404)
        expect(db.prepare('SELECT COUNT(*) n FROM rate_limits').get()?.n).toBe(1)
    } finally {
        db.close()
    }
}, 60_000)

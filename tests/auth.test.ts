import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { betterAuth } from 'better-auth'
import { createAuthEndpoint } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { expect, test, vi } from 'vitest'
import { z } from 'zod'

import { authSqliteRelations, authSqliteSchema as schema } from '../.vitehub/auth/schema'
import {
    relations as mergedRelations,
    schema as mergedSchema,
} from '../.vitehub/database/schema/default'
import { openTestDatabase } from './helpers/database'

test('auth counters bound unknown paths and dynamic routes while preserving ingress rules', async () => {
    const local = openTestDatabase()
    const db = local.sqlite
    try {
        const auth = betterAuth({
            baseURL: 'https://auth.invalid',
            secret: 'test-only-auth-secret-not-for-deployment',
            database: drizzleAdapter(drizzle({ client: db, relations: authSqliteRelations }), {
                provider: 'sqlite',
                schema,
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
                        if (new URL(req.url).pathname.startsWith('/api/auth/rewrite-')) {
                            return {
                                request: new Request(
                                    'https://auth.invalid/api/auth/probe/rewritten',
                                    req,
                                ),
                            }
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

        expect(db.prepare('SELECT COUNT(*) n FROM rate_limit').get()?.n).toBe(1)
        expect((await request('/missing-c')).status).toBe(429)
        expect((await request('/missing-c', '198.51.100.21')).status).toBe(404)

        for (const path of ['/probe/a', '/probe/a%2Fb', '/probe/%41?x=1'])
            expect((await request(path)).status).toBe(200)

        expect((await request('/probe/next')).status).toBe(429)
        expect((await request('/probe/strict')).status).toBe(429)
        expect(db.prepare('SELECT COUNT(*) n FROM rate_limit').get()?.n).toBe(3)
        for (let i = 0; i < 4; i++) expect((await request('/get-session')).status).toBe(200)

        expect((await request('/get-session')).status).toBe(429)

        const invalidPaths: ReadonlyArray<readonly [string, string]> = [
            ['/probe/id', 'HEAD'],
            ['/probe//id', 'GET'],
            ['/probe/id/', 'GET'],
        ]
        for (const [path, method] of invalidPaths)
            expect((await request(path, '198.51.100.22', method)).status).toBe(404)

        expect((await request('/rewrite-first', '198.51.100.23')).status).toBe(200)
        expect((await request('/early-second', '198.51.100.23')).status).toBe(200)
        expect((await request('/rewrite-third', '198.51.100.23')).status).toBe(200)
        expect((await request('/early-fourth', '198.51.100.23')).status).toBe(429)
        expect(
            db.prepare('SELECT COUNT(*) n FROM rate_limit WHERE key LIKE ?').get('198.51.100.23|%')
                ?.n,
        ).toBe(1)
        db.exec('UPDATE rate_limit SET last_request = 0')
        expect((await request('/missing-after-expiry')).status).toBe(404)
        expect(db.prepare('SELECT COUNT(*) n FROM rate_limit').get()?.n).toBe(1)
    } finally {
        local.close()
    }
}, 60_000)

test('auth resolves session and user via Drizzle v1 relations-v2 joins', async () => {
    const local = openTestDatabase()
    const db = local.sqlite
    try {
        const drizzleDb = drizzle({ client: db, relations: mergedRelations })
        const auth = betterAuth({
            baseURL: 'https://auth.invalid',
            secret: 'test-only-auth-secret-not-for-deployment',
            database: drizzleAdapter(drizzleDb, {
                provider: 'sqlite',
                schema: mergedSchema,
            }),
            emailAndPassword: { enabled: true },
            session: {
                cookieCache: { enabled: false },
            },
            plugins: [admin({ defaultRole: 'user' })],
            advanced: {
                database: { joins: true },
            },
        })

        const signUp = await auth.handler(
            new Request('https://auth.invalid/api/auth/sign-up/email', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    email: 'joins@example.invalid',
                    name: 'Joins Tester',
                    password: 'correct-horse-battery-staple',
                }),
            }),
        )
        expect(signUp.status).toBe(200)
        const cookies = signUp.headers
            .getSetCookie()
            .map((value) => value.split(';')[0])
            .filter(Boolean)
            .join('; ')
        expect(cookies).toContain('session_token=')

        const sessionQuery = drizzleDb.query.session
        if (!sessionQuery) throw new Error('Missing session relational query builder')
        const findFirstSpy = vi.spyOn(sessionQuery, 'findFirst')
        const sessionResponse = await auth.handler(
            new Request('https://auth.invalid/api/auth/get-session', {
                headers: { cookie: cookies },
            }),
        )
        expect(sessionResponse.status).toBe(200)
        expect(findFirstSpy).toHaveBeenCalledTimes(1)
        const payload = z
            .object({
                session: z.object({ userId: z.string() }),
                user: z.object({ email: z.string(), id: z.string() }),
            })
            .parse(await sessionResponse.json())
        expect(payload.user.email).toBe('joins@example.invalid')
        expect(payload.session.userId).toBe(payload.user.id)

        const typedAuthDb = drizzle({ client: db, relations: authSqliteRelations })
        const joined = await typedAuthDb.query.session.findFirst({
            with: { user: true },
        })
        expect(joined?.user?.email).toBe('joins@example.invalid')
    } finally {
        local.close()
    }
}, 60_000)

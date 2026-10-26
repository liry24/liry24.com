import * as schema from '../../../../../db/schema'
import { auth } from '../../auth'
import { db, sqlite } from '../../database'

export default defineEventHandler(async (event) => {
    const input = await readBody(event)
    if (input.action === 'seed') {
        sqlite.exec(
            'DELETE FROM admin_events; DELETE FROM sessions; DELETE FROM accounts; DELETE FROM users;',
        )
        for (let i = 0; i < 23; i++) {
            const id = `user-${String(i).padStart(2, '0')}`
            sqlite
                .prepare(
                    'INSERT INTO users (id,name,email,email_verified,username,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
                )
                .run(
                    id,
                    `User ${i}`,
                    `${i}@example.invalid`,
                    1,
                    i === 22 ? null : `name-${i}`,
                    'user',
                    1700000000000,
                    1700000000000,
                )
        }
        sqlite
            .prepare(
                'INSERT INTO accounts (id,account_id,provider_id,user_id,access_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            )
            .run(
                'account',
                '123',
                'github',
                'user-00',
                'SECRET_OAUTH',
                1700000000000,
                1700000000000,
            )
        for (let i = 0; i < 23; i++)
            sqlite
                .prepare(
                    'INSERT INTO admin_events (id,actor_id,action,target_id,model,label,created_at) VALUES (?,?,?,?,?,?,?)',
                )
                .run(
                    `event-${String(i).padStart(2, '0')}`,
                    'user-00',
                    'content.update',
                    'deleted-entry',
                    'posts',
                    'Retained title',
                    1700000000000,
                )
        for (const action of [
            'account.update',
            'session.create',
            'session.logout',
            'session.revoke',
            'provider.link',
            'provider.unlink',
            'passkey.create',
            'passkey.update',
            'passkey.delete',
        ])
            sqlite
                .prepare(
                    'INSERT INTO admin_events (id,actor_id,action,target_id,label,created_at) VALUES (?,?,?,?,?,?)',
                )
                .run(
                    action,
                    'user-01',
                    action,
                    'private-target',
                    'PRIVATE ACCOUNT ACTIVITY',
                    1700000000000,
                )
        return { ok: true }
    }
    if (input.action === 'events') return db.select().from(schema.adminEvents)
    if (input.action === 'credentials') {
        const account = await (
            await auth.$context
        ).internalAdapter.createAccount({
            userId: input.userId,
            providerId: 'github',
            accountId: '456',
            accessToken: 'SECRET_LINK',
        })
        await db.insert(schema.passkeys).values({
            id: 'synthetic-passkey',
            userId: input.userId,
            name: 'Original',
            publicKey: 'synthetic-key',
            credentialID: 'synthetic-credential',
            counter: 0,
            deviceType: 'singleDevice',
            backedUp: false,
        })
        return { accountId: account.id }
    }
    if (input.action === 'failActivity') {
        sqlite.exec(
            "CREATE TRIGGER fail_activity BEFORE INSERT ON admin_events BEGIN SELECT RAISE(FAIL, 'synthetic storage failure'); END",
        )
        return { ok: true }
    }
    if (input.action === 'auth') {
        const response = await auth.handler(
            new Request(`http://localhost/api/auth${input.path}`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    origin: 'http://localhost',
                    ...(input.cookie ? { cookie: input.cookie } : {}),
                },
                body: JSON.stringify(input.body ?? {}),
            }),
        )
        return {
            status: response.status,
            body: await response.json(),
            cookies: response.headers.getSetCookie(),
        }
    }
    throw createError({ status: 400 })
})

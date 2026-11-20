import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'

import { exportJWK, generateKeyPair, SignJWT } from 'jose'

export async function oidcProvider() {
    const keys = await generateKeyPair('RS256')
    const publicKey = {
        ...(await exportJWK(keys.publicKey)),
        kid: 'synthetic',
        alg: 'RS256',
        use: 'sig',
    }
    const codes = new Map<string, { nonce: string; challenge: string; redirect: string }>()
    let identity = {
        sub: 'new-user',
        email: 'new@example.invalid',
        email_verified: true,
        name: 'New user',
    }
    let invalidClaim: 'nonce' | 'issuer' | 'audience' | 'signature' | undefined
    let issuer = ''
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url!, issuer)
            response.setHeader('content-type', 'application/json')
            if (url.pathname === '/.well-known/openid-configuration') {
                response.end(
                    JSON.stringify({
                        issuer,
                        authorization_endpoint: issuer + '/authorize',
                        token_endpoint: issuer + '/token',
                        jwks_uri: issuer + '/jwks',
                        response_types_supported: ['code'],
                        subject_types_supported: ['public'],
                        id_token_signing_alg_values_supported: ['RS256'],
                        token_endpoint_auth_methods_supported: ['client_secret_post'],
                        code_challenge_methods_supported: ['S256'],
                    }),
                )
            } else if (url.pathname === '/jwks') response.end(JSON.stringify({ keys: [publicKey] }))
            else if (url.pathname === '/authorize') {
                if (
                    url.searchParams.get('code_challenge_method') !== 'S256' ||
                    !url.searchParams.get('nonce')
                )
                    throw new Error('PKCE and nonce are required')
                const code = randomUUID()
                codes.set(code, {
                    nonce: url.searchParams.get('nonce')!,
                    challenge: url.searchParams.get('code_challenge')!,
                    redirect: url.searchParams.get('redirect_uri')!,
                })
                const redirect = new URL(url.searchParams.get('redirect_uri')!)
                redirect.searchParams.set('code', code)
                redirect.searchParams.set('state', url.searchParams.get('state')!)
                response.writeHead(302, { location: redirect.href }).end()
            } else if (url.pathname === '/token') {
                let body = ''
                for await (const chunk of request) body += chunk
                const params = new URLSearchParams(body)
                const code = codes.get(params.get('code') ?? '')
                codes.delete(params.get('code') ?? '')
                if (
                    !code ||
                    params.get('client_id') !== 'synthetic-pocket-client' ||
                    params.get('client_secret') !== 'synthetic-pocket-secret' ||
                    params.get('redirect_uri') !== code.redirect ||
                    createHash('sha256')
                        .update(params.get('code_verifier') ?? '')
                        .digest('base64url') !== code.challenge
                )
                    throw new Error('Invalid code exchange')
                const signingKey =
                    invalidClaim === 'signature'
                        ? (await generateKeyPair('RS256')).privateKey
                        : keys.privateKey
                const token = await new SignJWT({
                    ...identity,
                    nonce: invalidClaim === 'nonce' ? 'wrong-nonce' : code.nonce,
                })
                    .setProtectedHeader({ alg: 'RS256', kid: 'synthetic' })
                    .setIssuer(invalidClaim === 'issuer' ? 'https://wrong.invalid' : issuer)
                    .setAudience(
                        invalidClaim === 'audience' ? 'wrong-client' : 'synthetic-pocket-client',
                    )
                    .setIssuedAt()
                    .setExpirationTime('5m')
                    .sign(signingKey)
                response.end(
                    JSON.stringify({
                        access_token: 'synthetic-access',
                        token_type: 'Bearer',
                        expires_in: 300,
                        id_token: token,
                    }),
                )
            } else response.writeHead(404).end('{}')
        } catch {
            response.writeHead(400).end(JSON.stringify({ error: 'invalid_request' }))
        }
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing OIDC server address')
    issuer = `http://127.0.0.1:${address.port}`
    return {
        issuer,
        identity(value: typeof identity) {
            identity = value
        },
        invalid(value: typeof invalidClaim) {
            invalidClaim = value
        },
        close: () =>
            new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve())),
            ),
    }
}

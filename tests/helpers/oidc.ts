import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

import { exportJWK, generateKeyPair, SignJWT } from 'jose'

export interface OidcIdentity {
    sub: string
    email: string
    email_verified: boolean
    name: string
}

export async function oidcProvider() {
    const keys = await generateKeyPair('RS256')
    const publicKey = {
        ...(await exportJWK(keys.publicKey)),
        kid: 'synthetic',
        alg: 'RS256',
        use: 'sig',
    }
    const codes = new Map<string, { nonce: string; challenge: string; redirect: string }>()
    let identity: OidcIdentity = {
        sub: 'owner-sub',
        email: 'owner@example.invalid',
        email_verified: true,
        name: 'Site owner',
    }
    let invalidClaim: 'nonce' | 'issuer' | 'audience' | 'signature' | undefined
    let issuer = ''

    async function handleRequest(request: IncomingMessage, response: ServerResponse) {
        try {
            const url = new URL(request.url ?? '/', issuer)
            response.setHeader('content-type', 'application/json')
            if (url.pathname === '/.well-known/openid-configuration') {
                response.end(
                    JSON.stringify({
                        issuer,
                        authorization_endpoint: `${issuer}/authorize`,
                        token_endpoint: `${issuer}/token`,
                        jwks_uri: `${issuer}/jwks`,
                        response_types_supported: ['code'],
                        subject_types_supported: ['public'],
                        id_token_signing_alg_values_supported: ['RS256'],
                        token_endpoint_auth_methods_supported: ['client_secret_post'],
                        code_challenge_methods_supported: ['S256'],
                    }),
                )
                return
            }
            if (url.pathname === '/jwks') {
                response.end(JSON.stringify({ keys: [publicKey] }))
                return
            }
            if (url.pathname === '/authorize') {
                const nonce = url.searchParams.get('nonce')
                const challenge = url.searchParams.get('code_challenge')
                const redirectUri = url.searchParams.get('redirect_uri')
                const state = url.searchParams.get('state')
                if (
                    url.searchParams.get('code_challenge_method') !== 'S256' ||
                    !nonce ||
                    !challenge ||
                    !redirectUri ||
                    !state
                )
                    throw new Error('PKCE, nonce, redirect_uri, and state are required')

                const code = randomUUID()
                codes.set(code, {
                    nonce,
                    challenge,
                    redirect: redirectUri,
                })
                const redirect = new URL(redirectUri)
                redirect.searchParams.set('code', code)
                redirect.searchParams.set('state', state)
                response.writeHead(302, { location: redirect.href }).end()
                return
            }
            if (url.pathname === '/token') {
                let body = ''
                for await (const chunk of request) body += String(chunk)

                const params = new URLSearchParams(body)
                const codeKey = params.get('code') ?? ''
                const code = codes.get(codeKey)
                codes.delete(codeKey)
                const clientId = params.get('client_id')
                const clientSecret = params.get('client_secret')
                const redirectUri = params.get('redirect_uri')
                const verifierDigest = createHash('sha256')
                    .update(params.get('code_verifier') ?? '')
                    .digest('base64url')
                if (!code) throw new Error(`missing or unknown code: "${codeKey}"`)

                if (clientId !== 'synthetic-pocket-client')
                    throw new Error(`client_id mismatch: got=${String(clientId)}`)

                if (clientSecret !== 'synthetic-pocket-secret')
                    throw new Error(`client_secret mismatch: present=${Boolean(clientSecret)}`)

                if (redirectUri !== code.redirect) {
                    throw new Error(
                        `redirect_uri mismatch: got=${String(redirectUri)} expected=${code.redirect}`,
                    )
                }
                if (verifierDigest !== code.challenge) {
                    throw new Error(
                        `code_verifier mismatch: gotDigest=${verifierDigest} expected=${code.challenge}`,
                    )
                }
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
                return
            }
            response.writeHead(404).end('{}')
        } catch (error) {
            const description = error instanceof Error ? error.message : String(error)
            response
                .writeHead(400)
                .end(JSON.stringify({ error: 'invalid_request', error_description: description }))
        }
    }

    const server = createServer((request, response) => {
        void handleRequest(request, response)
    })

    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing OIDC server address')

    issuer = `http://127.0.0.1:${address.port}`
    return {
        issuer,
        identity(value: OidcIdentity) {
            identity = value
        },
        invalid(value: typeof invalidClaim) {
            invalidClaim = value
        },
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error)
                    else resolve()
                })
            }),
    }
}

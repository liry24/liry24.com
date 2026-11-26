import { expect, test } from 'vitest'

import {
    buildTrustedOrigins,
    normalizeIssuer,
    parseCsvList,
    resolveAuthBaseUrl,
} from '../server/utils/authOrigin'

test('parseCsvList trims entries and skips empty segments', () => {
    expect(parseCsvList(undefined)).toEqual([])
    expect(parseCsvList('  ')).toEqual([])
    expect(parseCsvList(' a@example.com , , b@example.com ')).toEqual([
        'a@example.com',
        'b@example.com',
    ])
})

test('normalizeIssuer falls back to default and strips trailing slashes', () => {
    expect(normalizeIssuer(undefined)).toBe('https://sso.liry24.com')
    expect(normalizeIssuer('')).toBe('https://sso.liry24.com')
    expect(normalizeIssuer('https://sso.example.com///')).toBe('https://sso.example.com')
    expect(normalizeIssuer('https://sso.example.com/oidc/')).toBe('https://sso.example.com/oidc')
})

test('resolveAuthBaseUrl enforces production, preview, and synthetic loopback allowlist boundaries', () => {
    expect(
        resolveAuthBaseUrl('https://liry24.com', 'https://fallback.invalid', false, 'production'),
    ).toBe('https://liry24.com')
    expect(
        resolveAuthBaseUrl(
            'https://dev-liry24-com.liry.workers.dev',
            'https://fallback.invalid',
            false,
            'production',
        ),
    ).toBe('https://dev-liry24-com.liry.workers.dev')

    // Workers preview domains allowed only outside production and over HTTPS
    expect(
        resolveAuthBaseUrl(
            'https://pr-42-liry24-com.liry.workers.dev',
            'https://fallback.invalid',
            false,
            'dev',
        ),
    ).toBe('https://pr-42-liry24-com.liry.workers.dev')
    expect(
        resolveAuthBaseUrl(
            'https://pr-42-liry24-com.liry.workers.dev',
            'https://fallback.invalid',
            false,
            'production',
        ),
    ).toBe('https://fallback.invalid')
    expect(
        resolveAuthBaseUrl(
            'http://pr-42-liry24-com.liry.workers.dev',
            'https://fallback.invalid',
            false,
            'dev',
        ),
    ).toBe('https://fallback.invalid')

    // Loopback HTTP allowed only in synthetic test mode
    expect(
        resolveAuthBaseUrl('http://127.0.0.1:8787', 'https://fallback.invalid', true, 'test'),
    ).toBe('http://127.0.0.1:8787')
    expect(
        resolveAuthBaseUrl('http://localhost:3000', 'https://fallback.invalid', true, 'test'),
    ).toBe('http://localhost:3000')
    expect(
        resolveAuthBaseUrl('https://localhost:3000', 'https://fallback.invalid', true, 'test'),
    ).toBe('https://fallback.invalid')
    expect(
        resolveAuthBaseUrl('http://127.0.0.1:8787', 'https://fallback.invalid', false, 'dev'),
    ).toBe('https://fallback.invalid')

    // Arbitrary or malformed origins fall back safely
    expect(
        resolveAuthBaseUrl('https://evil.example', 'https://fallback.invalid', true, 'dev'),
    ).toBe('https://fallback.invalid')
    expect(resolveAuthBaseUrl('not-a-url', '', false, 'production')).toBe('https://liry24.com')
})

test('buildTrustedOrigins deduplicates base URL with static production and dev origins', () => {
    expect(buildTrustedOrigins('https://liry24.com')).toEqual([
        'https://liry24.com',
        'https://dev-liry24-com.liry.workers.dev',
    ])
    expect(buildTrustedOrigins('https://pr-42.liry.workers.dev')).toEqual([
        'https://liry24.com',
        'https://dev-liry24-com.liry.workers.dev',
        'https://pr-42.liry.workers.dev',
    ])
})

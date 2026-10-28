import assert from 'node:assert/strict'

import { chromium, type Response } from 'playwright-core'
import { test } from 'vitest'

import { builtWorker } from '../helpers/builtWorker'

test.runIf(process.env.LIRY24_TEST_ADMIN_COMPOSER_BROWSER === 'true')(
    'native Worker passkeys register, sign in, rename and delete with a virtual authenticator',
    async () => {
        const app = await builtWorker()
        let browser
        const failures: string[] = []
        const diagnostics: string[] = []
        let success = false
        try {
            const userId = 'passkey-admin'
            const { cookie } = await app.session(userId)
            const settingsHtml = await (
                await app.server.fetch('/admin/settings', { headers: { cookie } })
            ).text()
            assert.match(
                settingsHtml,
                /href="\/admin\/users"/u,
                'Permission-scoped navigation is rendered on the server',
            )
            const origin = new URL(app.url)
            origin.hostname = 'localhost'
            const base = origin.origin
            browser = await chromium.launch({
                headless: true,
                ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
            })
            const publicContext = await browser.newContext()
            await publicContext.route('**/*', (route) =>
                new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
            )
            const publicPage = await publicContext.newPage()
            const publicSources: Promise<string>[] = []
            publicPage.on('pageerror', (error) => failures.push(error.message))
            const capturePublicSource = (response: Response) => {
                if (/\.(?:m?js)(?:\?|$)/u.test(response.url())) publicSources.push(response.text())
            }
            publicPage.on('response', capturePublicSource)
            await publicPage.goto(base + '/', { waitUntil: 'load' })
            await publicPage.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            publicPage.off('response', capturePublicSource)
            assert(publicSources.length > 0)
            for (const source of await Promise.all(publicSources))
                for (const marker of [
                    'Post editorial inference is not configured.',
                    'Proofread conservatively',
                    'Proofread Content',
                    'Publish reviewed list',
                    'synthetic-worker-auth-secret-0123456789abcdef',
                ])
                    assert(
                        !source.includes(marker),
                        'Private implementation entered a public script: ' + marker,
                    )
            await publicContext.close()

            const context = await browser.newContext()
            await context.route('**/*', (route) =>
                new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
            )
            await context.addCookies(
                ['better-auth.session_token', '__Secure-better-auth.session_token'].map((name) => ({
                    name,
                    value: cookie.split(';')[0]!.slice('better-auth.session_token='.length),
                    domain: 'localhost',
                    path: '/',
                    httpOnly: true,
                    sameSite: 'Lax' as const,
                    secure: name.startsWith('__Secure-'),
                })),
            )
            const page = await context.newPage()
            page.on('pageerror', (error) => failures.push(error.message))
            page.on('request', (request) => {
                if (new URL(request.url()).pathname.startsWith('/api/auth/'))
                    diagnostics.push('REQUEST ' + new URL(request.url()).pathname)
            })
            page.on('response', (response) => {
                if (new URL(response.url()).pathname.startsWith('/api/auth/'))
                    diagnostics.push(
                        'RESPONSE ' + response.status() + ' ' + new URL(response.url()).pathname,
                    )
            })
            page.on('console', (message) => {
                if (message.type() === 'error' || /hydration/i.test(message.text()))
                    diagnostics.push(message.text().slice(0, 2400))
                if (/hydration/i.test(message.text())) failures.push(message.text())
            })
            page.on('response', async (response) => {
                if (
                    new URL(response.url()).pathname.startsWith('/api/auth/passkey/') &&
                    !response.ok()
                )
                    diagnostics.push(
                        response.status() +
                            ' ' +
                            new URL(response.url()).pathname +
                            ': ' +
                            (await response.text()).slice(0, 1200),
                    )
            })
            const cdp = await context.newCDPSession(page)
            await cdp.send('WebAuthn.enable', { enableUI: false })
            await cdp.send('WebAuthn.addVirtualAuthenticator', {
                options: {
                    protocol: 'ctap2',
                    transport: 'internal',
                    hasResidentKey: true,
                    hasUserVerification: true,
                    isUserVerified: true,
                    automaticPresenceSimulation: true,
                },
            })
            await page.goto(base + '/admin/settings', {
                waitUntil: 'domcontentloaded',
            })
            const session = () =>
                page.evaluate(async () => await (await fetch('/api/auth/get-session')).json())
            assert.equal(
                (await session())?.user?.id,
                userId,
                'The localhost browser session is accepted',
            )
            const passkeys = await page.evaluate(async () => {
                const response = await fetch('/api/auth/passkey/list-user-passkeys')
                return { status: response.status, text: await response.text() }
            })
            assert.equal(passkeys.status, 200, passkeys.text)
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            const preview = await page.evaluate(
                () =>
                    (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties
                        .$nuxt.$config.public.preview,
            )
            assert.notEqual(
                String(preview),
                'true',
                'Synthetic public runtime config enables the production Passkey UI',
            )
            await page.getByRole('button', { name: 'Create passkey', exact: true }).click()
            await page.getByPlaceholder('Name this passkey (optional)').fill('Synthetic native key')
            await page
                .getByRole('dialog')
                .getByRole('button', { name: 'Create', exact: true })
                .click()
            await page.getByText('Passkey added', { exact: true }).waitFor()
            assert.equal(
                (
                    await app.env.DB.prepare(
                        'SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?',
                    )
                        .bind(userId)
                        .first<{ count: number }>()
                )?.count,
                1,
            )
            await page.getByRole('dialog').locator('button[data-slot="close"]').click()
            await page.getByRole('button', { name: 'Logout', exact: true }).first().click()
            await page.waitForURL((url) => url.pathname === '/')
            await page.goto(base + '/login')
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            assert.equal((await session())?.user?.id, undefined)
            await page.getByRole('button', { name: 'Passkey', exact: true }).click()
            await page.waitForURL(/\/admin(?:\/data)?(?:\?.*)?$/)
            assert.equal((await session())?.user?.id, userId)
            await page.goto(base + '/admin/settings', { waitUntil: 'domcontentloaded' })
            await page
                .getByLabel('Name for Synthetic native key', { exact: true })
                .fill('Renamed native key')
            await page.getByRole('button', { name: 'Rename', exact: true }).click()
            await page.getByText('Passkey renamed', { exact: true }).waitFor()
            assert.equal(
                (
                    await app.env.DB.prepare('SELECT name FROM passkey WHERE user_id = ?')
                        .bind(userId)
                        .first<{ name: string }>()
                )?.name,
                'Renamed native key',
            )
            await page
                .locator('#passkeys')
                .getByRole('button', { name: 'Delete', exact: true })
                .click()
            await page
                .getByRole('dialog')
                .getByRole('button', { name: 'Delete passkey', exact: true })
                .click()
            await page.getByText('Passkey deleted', { exact: true }).waitFor()
            assert.equal(
                (
                    await app.env.DB.prepare(
                        'SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?',
                    )
                        .bind(userId)
                        .first<{ count: number }>()
                )?.count,
                0,
            )
            assert.deepEqual(failures, [])
            success = true
        } finally {
            if (!success)
                console.error('Native Passkey diagnostics:', diagnostics.slice(-30), failures)
            await browser?.close()
            await app.close()
        }
    },
    120000,
)

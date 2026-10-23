import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { chromium } from 'playwright-core'
import { test } from 'vitest'
import { createTestHarness } from 'wrangler'

import type { ComposerPlan } from '../../shared/types/adminComposer'
import { baselineStatements } from '../helpers/database'

test.runIf(process.env.LIRY24_TEST_ADMIN_COMPOSER_BROWSER === 'true')(
    'composer isolates requests, selects models, saves mixed batches and keeps post drafts separate',
    async () => {
        await mkdir('.tmp', { recursive: true })
        const config = JSON.parse(await readFile('.void-wrangler.jsonc', 'utf8'))
        config.name = 'composer-browser-test'
        config.main = resolve('.output/server/index.mjs')
        config.assets = { binding: 'ASSETS', directory: resolve('.output/public') }
        config.vars = {
            ...config.vars,
            APP_ENV: 'test',
            OPENAI_BASE_URL: 'http://127.0.0.1:1/v1',
            NUXT_PUBLIC_PREVIEW: 'false',
            NUXT_PUBLIC_SITE_URL: '',
        }
        config.routes = []
        config.triggers = { crons: [] }
        config.d1_databases = [
            {
                binding: 'DB',
                database_name: 'composer-test',
                database_id: '00000000-0000-4000-8000-000000000099',
            },
        ]
        config.r2_buckets = [{ binding: 'STORAGE', bucket_name: 'composer-test-assets' }]
        delete config.ai
        delete config.previews
        const configPath = resolve('.tmp/composer-wrangler.json')
        await writeFile(configPath, JSON.stringify(config))
        const secrets = Object.fromEntries(
            [
                ...(config.secrets?.required ?? [
                    'BETTER_AUTH_SECRET',
                    'NUXT_APP_SECRET',
                    'GITHUB_CLIENT_ID',
                    'GITHUB_CLIENT_SECRET',
                ]),
                'PREVIEW_GITHUB_TOKEN',
            ].map((name) => [name, 'test-only-composer-secret-0123456789abcdef0123456789abcdef']),
        )
        const server = createTestHarness({ workers: [{ configPath, secrets }] })
        let browser
        const errors: string[] = []
        try {
            const { url } = await server.listen()
            config.vars.NUXT_PUBLIC_SITE_URL = url.origin
            await writeFile(configPath, JSON.stringify(config))
            await server.update({ workers: [{ configPath, secrets }] })
            const env = await server.getWorker<{ DB: D1Database }>().getEnv()
            await env.DB.batch(baselineStatements().map((sql) => env.DB.prepare(sql)))
            const now = Date.now()
            await env.DB.prepare(
                'INSERT INTO users (id,name,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
            )
                .bind(
                    'composer-admin',
                    'Synthetic admin',
                    'composer@example.invalid',
                    1,
                    'admin',
                    now,
                    now,
                )
                .run()
            await env.DB.prepare(
                'INSERT INTO sessions (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
            )
                .bind(
                    'composer-session',
                    'composer-token',
                    'composer-admin',
                    now + 3600000,
                    now,
                    now,
                )
                .run()
            const signed =
                'composer-token.' +
                createHmac('sha256', secrets.BETTER_AUTH_SECRET!)
                    .update('composer-token')
                    .digest('base64')
            const cookie =
                'better-auth.session_token=' +
                encodeURIComponent(signed) +
                '; __Secure-better-auth.session_token=' +
                encodeURIComponent(signed)
            browser = await chromium.launch({ headless: true })
            const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
            await context.route('**/*', (route) =>
                new URL(route.request().url()).origin === url.origin
                    ? route.continue()
                    : route.abort(),
            )
            await context.addCookies(
                ['better-auth.session_token', '__Secure-better-auth.session_token'].map((name) => ({
                    name,
                    value: encodeURIComponent(signed),
                    domain: url.hostname,
                    path: '/',
                    httpOnly: true,
                    sameSite: 'Lax' as const,
                    secure: name.startsWith('__Secure-'),
                })),
            )
            const session = await server.fetch('/api/auth/get-session', { headers: { cookie } })
            assert.equal(
                ((await session.json()) as { user?: { id: string } })?.user?.id,
                'composer-admin',
                'Synthetic session is accepted',
            )
            const page = await context.newPage()
            page.on('pageerror', (error) => errors.push(error.message))
            const goto = async (...args: Parameters<typeof page.goto>) => {
                await page.goto(...args)
                await page.waitForFunction(
                    () =>
                        (document.querySelector('#__nuxt') as any)?.__vue_app__?.config
                            .globalProperties.$nuxt?.isHydrating === false,
                )
            }
            const navigate = (path: string) =>
                page.evaluate(
                    (path) =>
                        (
                            document.querySelector('#__nuxt') as any
                        ).__vue_app__.config.globalProperties.$nuxt.$router.push(path),
                    path,
                )
            await goto(new URL('/admin/@test', url).href, { waitUntil: 'domcontentloaded' })
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await page.waitForFunction(() => document.title === 'test | Liry24 Admin')
            await navigate('/admin/@another')
            await page.waitForFunction(() => document.title === 'another | Liry24 Admin')
            assert(!errors.some((message) => message.includes('Invalid linked format')))
            let calls = 0,
                writes = 0
            page.on('request', (request) => {
                if (request.method() !== 'GET' && request.url().includes('/api/liti/')) writes++
            })
            await page.route('**/api/admin/compose', async (route) => {
                calls++
                const request = route.request().postDataJSON()
                const makePlan = (
                    model: ComposerPlan['model'],
                    values: ComposerPlan['values'] = {},
                ): ComposerPlan => {
                    const fields =
                        model === 'posts'
                            ? [
                                  { key: 'title', label: 'Title', kind: 'text', required: true },
                                  { key: 'tags', label: 'Tags', kind: 'array', required: true },
                              ]
                            : model === 'skills'
                              ? [
                                    { key: 'name', label: 'Name', kind: 'text', required: true },
                                    { key: 'icon', label: 'Icon', kind: 'text', required: true },
                                ]
                              : [
                                    { key: 'href', label: 'URL', kind: 'url', required: true },
                                    { key: 'label', label: 'Label', kind: 'text', required: true },
                                    { key: 'icon', label: 'Icon', kind: 'text', required: true },
                                ]
                    return {
                        model,
                        intent: model ? 'create' : 'clarify',
                        fields,
                        visibleFields:
                            model === 'posts' ? ['title'] : fields.map((field) => field.key),
                        datePurpose:
                            request.prompt === 'new post with schedule' ? 'publication' : 'none',
                        values,
                        publishAt:
                            request.prompt === 'new post with schedule' ? '2027-01-20T18:00' : '',
                        timeZone: request.timeZone,
                        dateIncomplete: false,
                        query: '',
                        results: [],
                        total: 0,
                    }
                }
                if (request.prompt.startsWith('batch') || request.prompt === 'unknown') {
                    const plans =
                        request.prompt === 'unknown'
                            ? [
                                  request.items
                                      ? makePlan(request.items[0].model, {
                                            name: 'Chosen skill',
                                            icon: '',
                                        })
                                      : makePlan(null),
                              ]
                            : request.prompt === 'batch partial'
                              ? [0, 1].map((i) =>
                                    makePlan('socials', {
                                        href: `https://unknown.invalid/partial${i}`,
                                        label: `Partial ${i}`,
                                        icon: '',
                                    }),
                                )
                              : [
                                    makePlan('socials', {
                                        href: 'https://unknown.invalid/alice',
                                        label: '@alice',
                                        icon: '',
                                    }),
                                    makePlan('skills', {
                                        name: 'Blender',
                                        icon: 'simple-icons:blender',
                                    }),
                                    makePlan('posts', { title: 'First article' }),
                                    makePlan('posts', { title: 'Second article' }),
                                ]
                    await route.fulfill({
                        contentType: 'application/json',
                        body: JSON.stringify({
                            requestId: request.requestId,
                            items: plans.map((plan, i) => ({
                                id: request.requestId + '.' + i,
                                source: { start: 0, end: request.prompt.length },
                                plan,
                            })),
                        }),
                    })
                    return
                }
                const plan = makePlan(
                    request.prompt.startsWith('new post') ? 'posts' : 'socials',
                    request.prompt.startsWith('new post')
                        ? { title: 'Prepared post', tags: ['vue', 'nuxt'] }
                        : {
                              href: 'https://github.com/example',
                              label: request.prompt === 'second' ? 'Another suggestion' : 'GitHub',
                              icon: 'simple-icons:github',
                          },
                )
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        requestId: request.requestId,
                        items: [
                            {
                                id: request.requestId + '.0',
                                source: { start: 0, end: request.prompt.length },
                                plan,
                            },
                        ],
                    }),
                })
            })
            const html = await (await server.fetch('/admin/data', { headers: { cookie } })).text()
            assert.match(
                html,
                /<input[^>]*id="admin-compose-input"/,
                'The input must be server rendered',
            )
            const noJsContext = await browser.newContext({ javaScriptEnabled: false })
            await noJsContext.addCookies(await context.cookies())
            const noJsPage = await noJsContext.newPage()
            await noJsPage.goto(new URL('/admin/data', url).href)
            assert(await noJsPage.getByRole('textbox', { name: 'Content request' }).isVisible())
            await noJsContext.close()
            let releaseModels!: () => void
            const modelsGate = new Promise<void>((resolve) => {
                releaseModels = resolve
            })
            let modelRequests = 0
            await page.route('**/api/liti/models**', async (route) => {
                modelRequests++
                await modelsGate
                await route.continue()
            })
            await navigate('/admin/data')
            assert(
                await page.getByRole('textbox', { name: 'Content request' }).isVisible(),
                'Input does not wait for models',
            )
            releaseModels()
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            assert(
                !(await page.locator('body').innerText()).includes('Back to Home'),
                'Admin SSR failed',
            )
            await page.getByLabel('Content request').fill('new social')
            await page.getByRole('button', { name: 'Save', exact: true }).waitFor()
            await page.getByLabel('Label', { exact: true }).fill('My GitHub')
            const beforeToggle = calls
            await page.keyboard.press('Control+k')
            await page.getByRole('dialog').getByLabel('Label', { exact: true }).waitFor()
            assert.equal(
                await page.getByRole('dialog').getByLabel('Label', { exact: true }).inputValue(),
                'My GitHub',
            )
            await page.keyboard.press('Escape')
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            assert.equal(await page.getByLabel('Label', { exact: true }).inputValue(), 'My GitHub')
            assert.equal(calls, beforeToggle, 'Switching surfaces reuses the result')
            await page.getByLabel('Content request').fill('second')
            await page.getByText('Preparing…', { exact: true }).waitFor({ state: 'hidden' })
            assert.equal(
                await page.getByLabel('Label', { exact: true }).inputValue(),
                'Another suggestion',
            )
            assert.equal(await page.getByText('Unsaved input restored', { exact: true }).count(), 0)
            await page.getByLabel('Label', { exact: true }).fill('My GitHub')
            assert.equal(writes, 0, 'Inference must not mutate content')
            assert.equal(modelRequests, 1, 'Navigation and form reuse one models request')
            await page.screenshot({ path: '.tmp/composer-desktop.png', fullPage: true })
            let releaseSave!: () => void
            const saveGate = new Promise<void>((resolve) => {
                releaseSave = resolve
            })
            await page.route('**/api/liti/entries/socials', async (route) => {
                await saveGate
                await route.continue()
            })
            await page.getByRole('button', { name: 'Save', exact: true }).click()
            await page.waitForFunction(
                () =>
                    (document.querySelector('#admin-compose-input') as HTMLInputElement)?.disabled,
            )
            assert(await page.getByLabel('Content request').isDisabled())
            await page.keyboard.press('Control+k')
            assert.equal(await page.getByRole('dialog').count(), 0, 'Saving keeps its form mounted')
            await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
            assert.equal(
                new URL(page.url()).pathname,
                '/admin/data',
                'Navigation waits for the save',
            )
            releaseSave()
            await page.getByText('Saved', { exact: true }).waitFor()
            assert.equal(writes, 1, 'Saving is explicit')
            await page.getByLabel('Content request').fill('new post')
            await page.getByRole('button', { name: 'Continue in Post Editor' }).waitFor()
            assert.equal(await page.getByLabel('Title', { exact: true }).count(), 1)
            assert.equal(await page.getByText('Publication schedule', { exact: true }).count(), 0)
            assert.equal(await page.getByLabel('Tags', { exact: true }).count(), 0)
            const entries = await server.fetch('/api/liti/entries?model=socials&locale=ja', {
                headers: { cookie },
            })
            assert.equal(entries.status, 200)
            assert.equal(((await entries.json()) as any).items[0].data.label, 'My GitHub')
            await goto(new URL('/admin/posts/new', url).href, {
                waitUntil: 'domcontentloaded',
            })
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await page.getByLabel('Title', { exact: true }).fill('Existing unsaved title')
            await page.getByLabel('Content', { exact: true }).fill('Existing unsaved body')
            await page.waitForFunction(() => {
                const state = (document.querySelector('#__nuxt') as any).__vue_app__.config
                    .globalProperties.$nuxt.payload.state
                return Object.values(state['$sliti:form-drafts'] ?? {}).some(
                    (draft: any) => draft.value.title === 'Existing unsaved title',
                )
            })
            await page.getByRole('link', { name: 'Data', exact: true }).click()
            await page.getByLabel('Content request').fill('new post with schedule')
            await page.getByRole('button', { name: 'Continue in Post Editor' }).click()
            await page.waitForURL('**/admin/posts/new?composer=*', { timeout: 10000 })
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Prepared post',
            )
            assert.equal(
                await page.getByRole('button', { name: 'Apply prepared values' }).count(),
                0,
            )
            assert.equal(await page.getByLabel('Content', { exact: true }).inputValue(), '')
            assert.equal(
                await page.getByLabel('Publish at', { exact: true }).inputValue(),
                '2027-01-20T18:00',
            )
            await page.keyboard.press('Control+k')
            await page.getByRole('dialog').waitFor()
            await page.keyboard.press('Escape')
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            await page.keyboard.press('Control+k')
            await page.getByRole('dialog').waitFor()
            await page.getByRole('dialog').getByLabel('Content request').waitFor()
            assert.equal(await page.locator('#admin-compose-input').count(), 1)
            await page.keyboard.press('Escape')
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            await page.getByRole('link', { name: 'Data', exact: true }).click()
            await page.getByLabel('Content request').fill('unknown')
            await page.getByText('どの種類のデータを追加しますか？').waitFor()
            const beforeSelect = calls
            await page.getByRole('button', { name: 'Skills', exact: true }).click()
            await page.getByLabel('Name', { exact: true }).waitFor()
            assert.equal(
                await page.getByLabel('Name', { exact: true }).inputValue(),
                'Chosen skill',
            )
            assert.equal(calls, beforeSelect + 1)
            await page.getByLabel('Content request').fill('batch mixed')
            await page.locator('[data-composer-item]').nth(3).waitFor()
            const cards = page.locator('[data-composer-item]')
            await cards.nth(0).getByRole('button', { name: 'Save', exact: true }).waitFor()
            await cards.nth(1).getByRole('button', { name: 'Save Draft', exact: true }).waitFor()
            assert.equal(await cards.nth(0).getByLabel('Icon', { exact: true }).inputValue(), '')
            const beforeAll = writes
            await page.getByRole('button', { name: 'Save all', exact: true }).click()
            await cards.nth(1).getByText('Saved', { exact: true }).waitFor()
            assert.equal(writes, beforeAll + 2, 'Save all excludes posts')
            const savedSocials = (await (
                await server.fetch('/api/liti/entries?model=socials&locale=ja', {
                    headers: { cookie },
                })
            ).json()) as any
            assert.equal(
                savedSocials.items.find((entry: any) => entry.data.label === '@alice').data.icon,
                '',
            )
            assert.equal(modelRequests, 1, 'All composer forms share model metadata')
            await cards.nth(2).getByRole('button', { name: 'Continue in Post Editor' }).click()
            await page.waitForURL('**/admin/posts/new?composer=*', { timeout: 10000 })
            await page.getByLabel('Title', { exact: true }).fill('First edited article')
            await page.getByLabel('Content', { exact: true }).fill('First article body')
            await page.keyboard.press('Control+k')
            await page
                .getByRole('dialog')
                .locator('[data-composer-item]')
                .nth(3)
                .getByRole('button', { name: 'Continue in Post Editor' })
                .click()
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            await page.getByLabel('Title', { exact: true }).waitFor()
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Second article',
            )
            assert.equal(await page.getByLabel('Content', { exact: true }).inputValue(), '')
            await page.getByLabel('Content', { exact: true }).fill('Second article body')
            await page.keyboard.press('Control+k')
            await page
                .getByRole('dialog')
                .locator('[data-composer-item]')
                .nth(2)
                .getByRole('button', { name: 'Continue in Post Editor' })
                .click()
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            await page.getByLabel('Title', { exact: true }).waitFor()
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'First edited article',
            )
            assert.equal(
                await page.getByLabel('Content', { exact: true }).inputValue(),
                'First article body',
            )
            await navigate('/admin/posts/new')
            await page.getByLabel('Title', { exact: true }).waitFor()
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Existing unsaved title',
            )
            assert.equal(
                await page.getByLabel('Content', { exact: true }).inputValue(),
                'Existing unsaved body',
            )
            await page.getByRole('link', { name: 'Data', exact: true }).click()
            await page.getByLabel('Content request').fill('batch partial')
            await page
                .locator('[data-composer-item]')
                .nth(1)
                .getByRole('button', { name: 'Save', exact: true })
                .waitFor()
            let attempts = 0
            await page.route('**/api/liti/entries/socials', async (route) => {
                if (++attempts === 2)
                    await route.fulfill({
                        status: 500,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            error: { code: 'SYNTHETIC_FAILURE', message: 'Synthetic save failure' },
                        }),
                    })
                else await route.continue()
            })
            const beforePartial = writes
            await page.getByRole('button', { name: 'Save all', exact: true }).click()
            await page.getByText('Synthetic save failure', { exact: true }).first().waitFor()
            assert.equal(await page.getByText('Saved', { exact: true }).count(), 1)
            assert.equal(await page.getByLabel('Label', { exact: true }).inputValue(), 'Partial 1')
            await page.getByRole('button', { name: 'Save all', exact: true }).click()
            await page
                .locator('[data-composer-item]')
                .nth(1)
                .getByText('Saved', { exact: true })
                .waitFor()
            assert.equal(writes, beforePartial + 3, 'Retry saves only the failed item')
            await page.setViewportSize({ width: 390, height: 844 })
            await goto(new URL('/admin/data', url).href, { waitUntil: 'domcontentloaded' })
            await page.getByLabel('Content request').waitFor()
            assert(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= window.innerWidth,
                ),
                'Mobile layout overflows',
            )
            await page.screenshot({ path: '.tmp/composer-mobile.png', fullPage: true })
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await page.getByLabel('Content request').fill('mobile social')
            await page.getByRole('button', { name: 'Save', exact: true }).waitFor()
            assert(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= window.innerWidth,
                ),
                'Expanded mobile form overflows',
            )
            await page.screenshot({ path: '.tmp/composer-mobile-form.png', fullPage: true })
            assert.deepEqual(errors, [])
            assert(calls >= 4)
            assert.equal(writes, 6)
            // Verify real user links, activity and session revocation against the emitted app.
            await env.DB.prepare('UPDATE users SET username = ?, display_username = ? WHERE id = ?')
                .bind('synthetic-admin', 'Synthetic-Admin', 'composer-admin')
                .run()
            await page.setViewportSize({ width: 1280, height: 900 })
            await goto(new URL('/admin/users', url).href)
            const userLink = page.getByRole('link', { name: 'Synthetic admin', exact: true })
            await userLink.waitFor()
            assert.equal(await userLink.getAttribute('href'), '/admin/@synthetic-admin')
            await userLink.click()
            await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor()
            await page
                .getByRole('region', { name: 'Activity', exact: true })
                .getByText('Created', { exact: true })
                .first()
                .waitFor()
            await page.screenshot({ path: '.tmp/admin-user-desktop.png', fullPage: true })
            await page.setViewportSize({ width: 390, height: 844 })
            await page.screenshot({ path: '.tmp/admin-user-mobile.png', fullPage: true })
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            await page.setViewportSize({ width: 1280, height: 900 })
            for (const id of ['device-one', 'device-two'])
                await env.DB.prepare(
                    'INSERT INTO sessions (id,token,user_id,expires_at,created_at,updated_at,user_agent,ip_address) VALUES (?,?,?,?,?,?,?,?)',
                )
                    .bind(
                        id,
                        `token-${id}`,
                        'composer-admin',
                        now + 3600000,
                        now,
                        now,
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
                        '192.0.2.1',
                    )
                    .run()
            await goto(new URL('/admin/settings', url).href)
            await page.getByText('Current session', { exact: true }).waitFor()
            await page.getByRole('button', { name: 'Revoke', exact: true }).first().click()
            await page.waitForFunction(
                () =>
                    [...document.querySelectorAll('button')].filter(
                        (button) => button.textContent?.trim() === 'Revoke',
                    ).length === 1,
            )
            await page.screenshot({ path: '.tmp/admin-sessions-desktop.png', fullPage: true })
            await page.getByRole('button', { name: 'Logout Other Sessions', exact: true }).click()
            await page
                .getByRole('button', { name: 'Revoke', exact: true })
                .waitFor({ state: 'hidden' })
            assert.equal(
                (
                    await env.DB.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?')
                        .bind('composer-admin')
                        .first<{ count: number }>()
                )?.count,
                1,
            )
            await goto(new URL('/admin/users', url).href)
            const userRow = page.getByRole('row').filter({ hasText: 'composer@example.invalid' })
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await userRow.focus()
            assert(await userRow.evaluate((element) => element === document.activeElement))
            await userRow.press('Enter')
            await page.waitForURL('**/admin/@synthetic-admin')
            await page.getByText('Revoked a session', { exact: true }).first().waitFor()
            // Game fixtures and all browser traffic stay inside synthetic Worker bindings.
            async function create(model: string, data: Record<string, unknown>, id?: string) {
                const response = await server.fetch(`/api/liti/entries/${model}`, {
                    method: 'POST',
                    headers: { cookie, 'content-type': 'application/json' },
                    body: JSON.stringify({ id, data }),
                })
                const result = (await response.json()) as {
                    id: string
                    version: number
                    data: Record<string, unknown>
                }
                assert.equal(response.status, 201, JSON.stringify(result))
                return result
            }
            for (let index = 0; index < 21; index++)
                await create('posts', {
                    title: `Page Probe ${index}`,
                    content: 'Synthetic draft',
                    tags: [],
                    slug: `page-probe-${index}`,
                })
            await goto(new URL('/admin/@synthetic-admin', url).href)
            const timeline = page.getByRole('region', { name: 'Activity', exact: true })
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await timeline.getByRole('button', { name: 'Load more', exact: true }).click()
            await page.waitForFunction(
                () => document.querySelectorAll('[aria-label="Activity"] ol li').length > 20,
            )
            await goto(new URL('/admin/posts?q=Page%20Probe', url).href)
            const postsSection = page.locator('[data-model="posts"]')
            await postsSection.getByRole('link', { name: 'Page Probe 20', exact: true }).waitFor()
            assert.equal(await postsSection.count(), 1)
            assert.equal(await page.locator('#model-posts').count(), 1)
            assert.equal(
                await page.locator('[data-model="games"], [data-model="ranks"]').count(),
                0,
            )
            assert.equal(new URL(page.url()).pathname, '/admin/data')
            assert.equal(new URL(page.url()).searchParams.get('model'), 'posts')
            assert.equal(new URL(page.url()).searchParams.get('q'), 'Page Probe')
            assert.equal(await postsSection.locator('tbody tr').count(), 20)
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await postsSection.locator('[data-slot="next"]').click()
            await page.waitForFunction(
                () => document.querySelectorAll('[data-model="posts"] tbody tr').length === 1,
            )
            await postsSection
                .getByRole('textbox', { name: 'Search posts', exact: true })
                .fill('Page Probe 20')
            await postsSection.getByRole('link', { name: 'Page Probe 20', exact: true }).waitFor()
            await postsSection.getByRole('row').filter({ hasText: 'Page Probe 20' }).focus()
            await postsSection.getByRole('row').filter({ hasText: 'Page Probe 20' }).press('Enter')
            await page.getByLabel('Title', { exact: true }).waitFor()
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Page Probe 20',
            )
            await goto(new URL('/admin/posts?q=Page%20Probe%2020', url).href)
            await postsSection.getByRole('button', { name: 'Entry actions', exact: true }).click()
            await page.getByRole('button', { name: 'Delete', exact: true }).click()
            await postsSection.getByText('No posts found.', { exact: true }).waitFor()
            await page.keyboard.press('Escape')
            await create('skills', { name: 'Sort first', icon: 'mingcute:check-line' })
            await create('skills', { name: 'Sort second', icon: 'mingcute:check-line' })
            await goto(new URL('/admin/skills', url).href)
            const skillSection = page.locator('[data-model="skills"]')
            const reorder = skillSection
                .getByRole('button', { name: 'Reorder (arrow keys move item)', exact: true })
                .first()
            await reorder.waitFor()
            const nextTitle = await skillSection
                .locator('article button.truncate')
                .nth(1)
                .innerText()
            await page.route(
                '**/api/liti/entries/skills/reorder',
                (route) =>
                    route.fulfill({
                        status: 409,
                        json: {
                            error: { code: 'LITI_CONFLICT', message: 'Reorder conflict' },
                        },
                    }),
                { times: 1 },
            )
            await reorder.press('ArrowRight')
            await skillSection.getByText('Reorder conflict', { exact: true }).waitFor()
            assert.notEqual(
                await skillSection.locator('article button.truncate').first().innerText(),
                nextTitle,
            )
            const sorted = page.waitForResponse(
                (response) =>
                    response.url().includes('/api/liti/entries/skills/reorder') &&
                    response.request().method() === 'POST',
            )
            await reorder.press('ArrowRight')
            assert.equal((await sorted).status(), 200)
            assert.equal(
                await skillSection.getByText('Reorder conflict', { exact: true }).count(),
                0,
            )
            await page.waitForFunction(
                (expected) =>
                    document
                        .querySelector('[data-model="skills"] article button.truncate')
                        ?.textContent?.trim() === expected,
                nextTitle,
            )
            await skillSection.getByRole('button', { name: 'Add new Skill', exact: true }).click()
            const skillEditor = page.getByRole('dialog')
            await skillEditor.getByLabel('Name', { exact: true }).fill('Created in data page')
            await skillEditor.getByLabel('Icon', { exact: true }).fill('mingcute:check-line')
            await skillEditor.getByRole('button', { name: 'Save Draft', exact: true }).click()
            await skillEditor.waitFor({ state: 'hidden' })
            await skillSection
                .getByRole('button', { name: 'Created in data page', exact: true })
                .click()
            await skillEditor.getByLabel('Name', { exact: true }).fill('Edited in data page')
            await skillEditor.getByRole('button', { name: 'Save Draft', exact: true }).click()
            await skillEditor.waitFor({ state: 'hidden' })
            const editedSkill = skillSection
                .locator('article')
                .filter({ hasText: 'Edited in data page' })
            await editedSkill.getByRole('button', { name: 'Entry actions', exact: true }).click()
            await page.getByRole('button', { name: 'Delete', exact: true }).click()
            await editedSkill.waitFor({ state: 'hidden' })
            await page.keyboard.press('Escape')
            await page.screenshot({ path: '.tmp/admin-data-desktop.png', fullPage: true })
            await page.setViewportSize({ width: 390, height: 844 })
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            await page.screenshot({ path: '.tmp/admin-data-mobile.png', fullPage: true })
            await page.setViewportSize({ width: 1280, height: 900 })
            // Keep the independent game flow within the real per-minute auth limits.
            await env.DB.prepare('DELETE FROM rate_limits').run()
            const game = await create(
                'games',
                {
                    igdbId: 126459,
                    slug: 'valorant',
                    name: 'VALORANT',
                    primaryMetric: 'peakRank',
                    metrics: [
                        {
                            key: 'peakRank',
                            label: 'Highest rank',
                            format: 'integer',
                            positions: [
                                { value: 2000, label: 'Ascendant', color: '#22AA66' },
                                { value: 2100, label: 'Immortal', color: '#EF4444' },
                                { value: 2200, label: 'Uncolored rank' },
                            ],
                        },
                        { key: 'winRate', label: 'Win rate', format: 'percent' },
                    ],
                },
                'igdb-126459',
            )
            for (const [order, value, label, color] of [
                [1, 2000, 'Ascendant', '#22AA66'],
                [2, 2123, 'Immortal 1 23 RR', '#EF4444'],
                [3, 2123, 'Historic rank', '#22AA66'],
            ] as const)
                await create('gameStats', {
                    game: game.id,
                    periodKey: `act-${order}`,
                    period: `Act ${order}`,
                    order,
                    values: [
                        { key: 'peakRank', value, label, color },
                        { key: 'winRate', value: 50 },
                    ],
                    href: 'https://example.invalid/profile',
                })
            const post = await create('posts', {
                title: 'Played <game:valorant>',
                content: 'Before <game:valorant> after.\n\n<!-- more -->\n\nBody.',
                tags: [],
                slug: 'synthetic-game-mention',
            })
            const published = await server.fetch(`/api/liti/entries/${post.id}/publish`, {
                method: 'POST',
                headers: { cookie, 'content-type': 'application/json' },
                body: JSON.stringify({ expectedVersion: post.version }),
            })
            assert.equal(published.status, 200, await published.text())
            const denied = await server.fetch('/api/admin/games')
            assert.equal(denied.status, 401)
            const localGames = await server.fetch('/api/admin/games', { headers: { cookie } })
            assert.equal(localGames.status, 200)
            assert(
                ((await localGames.json()) as { games: { slug: string }[] }).games.some(
                    (game) => game.slug === 'valorant',
                ),
            )
            const imported = await server.fetch('/api/admin/games', {
                method: 'POST',
                headers: { cookie, 'content-type': 'application/json' },
                body: JSON.stringify({ igdbId: 126459, slug: 'ignored-client-slug' }),
            })
            assert.equal(imported.status, 200)
            assert.equal(((await imported.json()) as { id: string }).id, game.id)

            await page.route('**/api/admin/games?*', async (route) => {
                const query = new URL(route.request().url()).searchParams.get('q')
                if (query === 'v') await new Promise((resolve) => setTimeout(resolve, 700))
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        games: [
                            {
                                id: game.id,
                                igdbId: 126459,
                                slug: 'valorant',
                                name: query === 'v' ? 'Stale result' : 'VALORANT',
                            },
                        ],
                        warning: '',
                    }),
                })
            })
            await goto(new URL('/admin/posts/new', url).href, {
                waitUntil: 'domcontentloaded',
            })
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            const title = page.getByLabel('Title', { exact: true })
            await title.fill('Playing <game:')
            await page.getByRole('option', { name: 'VALORANT', exact: true }).waitFor()
            assert.equal(
                await title.evaluate((element) => element === document.activeElement),
                true,
            )
            await title.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 })
            assert.equal(await title.inputValue(), 'Playing <game:')
            await title.press('ArrowDown')
            await title.press('Enter')
            await page.waitForFunction(
                () =>
                    (document.querySelector('input[placeholder="Post title"]') as HTMLInputElement)
                        ?.value === 'Playing <game:valorant>',
            )
            await title.fill('Playing <game:v')
            await page.waitForTimeout(300)
            await title.fill('Playing <game:valo')
            await page.getByRole('option', { name: 'VALORANT', exact: true }).waitFor()
            await page.waitForTimeout(500)
            assert.equal(
                await page.getByRole('option', { name: 'Stale result', exact: true }).count(),
                0,
            )
            await title.press('Escape')
            assert.equal(await page.getByRole('listbox', { name: 'Games' }).count(), 0)
            await page.setViewportSize({ width: 1280, height: 900 })
            await goto(new URL('/posts/synthetic-game-mention', url).href)
            await page
                .getByRole('heading', { level: 1 })
                .getByRole('link', { name: 'VALORANT', exact: true })
                .waitFor()
            assert.equal(
                await page.locator('game-mention').count(),
                0,
                'Comark resolves the inline Vue component',
            )
            assert.equal(await page.title(), 'Played VALORANT | Liry24')
            await page
                .locator('main')
                .getByRole('link', { name: 'VALORANT', exact: true })
                .first()
                .click()
            await page.waitForURL('**/posts?game=valorant')
            await page.getByRole('heading').filter({ hasText: 'Played' }).waitFor()
            assert.equal(
                await page.locator('a a').count(),
                0,
                'Article and game links are siblings',
            )
            await goto(new URL('/', url).href)
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await page.getByRole('button', { name: /VALORANT Act 3/ }).click()
            await page.getByRole('dialog').getByRole('table').waitFor()
            await page.getByRole('dialog').locator('svg[role="img"]').waitFor()
            const chart = page.getByRole('dialog').locator('svg[role="img"]')
            assert((await chart.locator('linearGradient stop').count()) >= 3)
            assert.equal(await chart.locator('text').filter({ hasText: /^act-/ }).count(), 0)
            assert.equal(
                await page
                    .getByRole('dialog')
                    .getByRole('row')
                    .filter({ hasText: 'Immortal 1 23 RR' })
                    .count(),
                1,
            )
            await chart.focus()
            await chart.press('ArrowRight')
            await page.screenshot({ path: '.tmp/game-stats-desktop.png', fullPage: true })
            await page.setViewportSize({ width: 390, height: 844 })
            await page.waitForTimeout(300)
            await page.waitForFunction(() => {
                const element = document.querySelector('[role="dialog"]')
                const rect = element?.getBoundingClientRect()
                return (
                    rect &&
                    rect.left >= 0 &&
                    rect.right <= innerWidth &&
                    element!.scrollWidth <= element!.clientWidth
                )
            })
            await page.waitForFunction(() => {
                const tooltip = Array.from(
                    document.querySelectorAll('[data-reka-popper-content-wrapper]'),
                ).find((element) => element.textContent?.includes('Immortal 1 23 RR'))
                const rect = tooltip?.getBoundingClientRect()
                return rect && rect.left >= 0 && rect.right <= innerWidth
            })
            await page.screenshot({ path: '.tmp/game-stats-mobile.png', fullPage: true })
            await page
                .getByRole('dialog')
                .getByRole('button', { name: 'Close', exact: true })
                .click()
            await page.setViewportSize({ width: 1280, height: 900 })
            await goto(new URL('/admin/gameStats', url).href)
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            await page.getByRole('button', { name: 'Add new Game Stats', exact: true }).click()
            const editor = page.getByRole('dialog')
            await editor.getByRole('button', { name: 'Save', exact: true }).click()
            await editor.getByText('Check the fields before saving', { exact: true }).waitFor()
            await editor.getByLabel('Game', { exact: true }).click()
            await page.getByRole('option', { name: 'VALORANT', exact: true }).click()
            await editor.getByLabel('Period key', { exact: true }).fill('act-4')
            await editor.getByLabel('Period name', { exact: true }).fill('Act 4')
            await editor.getByLabel('Period order', { exact: true }).fill('4')
            await editor
                .getByRole('combobox', { name: 'Highest rank position', exact: true })
                .click()
            await page.getByRole('option', { name: 'Immortal', exact: true }).click()
            await editor
                .getByRole('combobox', { name: 'Highest rank position', exact: true })
                .click()
            await page.getByRole('option', { name: 'Uncolored rank', exact: true }).click()
            assert.equal(
                await editor.getByLabel('Recorded color (#RRGGBB)', { exact: true }).inputValue(),
                '',
            )
            await editor
                .getByRole('combobox', { name: 'Highest rank position', exact: true })
                .click()
            await page.getByRole('option', { name: 'Immortal', exact: true }).click()
            await editor
                .getByLabel('Numeric value (empty = missing)', { exact: true })
                .first()
                .fill('2123')
            await editor
                .getByLabel('Recorded display label', { exact: true })
                .fill('Immortal 1 23 RR')

            let uploadedImageId = ''
            const uploadReceived = Promise.withResolvers<void>()
            const releaseUpload = Promise.withResolvers<void>()
            await page.route('**/api/liti/assets', async (route) => {
                const response = await route.fetch()
                const body = (await response.json()) as { id: string }
                uploadedImageId = body.id
                uploadReceived.resolve()
                await releaseUpload.promise
                await route.fulfill({ response })
            })
            await editor
                .locator('input[type="file"]')
                .first()
                .setInputFiles({
                    name: 'rank.png',
                    mimeType: 'image/png',
                    buffer: Buffer.from(
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6f8AAAAASUVORK5CYII=',
                        'base64',
                    ),
                })
            await uploadReceived.promise
            try {
                for (const control of [
                    editor.getByRole('button', { name: 'Save', exact: true }),
                    editor.getByLabel('Numeric value (empty = missing)', { exact: true }).first(),
                    editor.locator('input[type="file"]').first(),
                ])
                    assert.equal(
                        await control.isDisabled(),
                        true,
                        'Editing waits for the image upload',
                    )
            } finally {
                releaseUpload.resolve()
            }
            await page.waitForFunction(
                () =>
                    !(
                        document.querySelector(
                            'button[form="admin-entry-form"]',
                        ) as HTMLButtonElement
                    )?.disabled,
            )
            await editor.locator('img').first().waitFor()
            assert(uploadedImageId)
            await editor.getByRole('button', { name: 'Save', exact: true }).click()
            await editor.waitFor({ state: 'hidden' })

            const statsResponse = await server.fetch('/api/liti/entries?model=gameStats', {
                headers: { cookie },
            })
            const stats = (await statsResponse.json()) as {
                items: { data: { periodKey: string; values: unknown[] } }[]
            }
            const savedPoint = stats.items.find((entry) => entry.data.periodKey === 'act-4')?.data
                .values[0] as {
                key: string
                value: number
                label: string
                image: string | { id: string }
                color: string
            }
            assert.equal(savedPoint.key, 'peakRank')
            assert.equal(savedPoint.value, 2123)
            assert.equal(savedPoint.label, 'Immortal 1 23 RR')
            assert.equal(savedPoint.color, '#EF4444')
            assert.equal(
                typeof savedPoint.image === 'string' ? savedPoint.image : savedPoint.image.id,
                uploadedImageId,
            )
            await goto(new URL('/admin/games', url).href)
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                        .$nuxt?.isHydrating === false,
            )
            assert.equal(await page.locator('[data-model="games"]').count(), 0)
            await page.route('**/api/admin/compose', async (route) => {
                const request = route.request().postDataJSON()
                await route.fulfill({
                    json: {
                        requestId: request.requestId,
                        items: [
                            {
                                id: request.requestId + '.0',
                                source: { start: 0, end: request.prompt.length },
                                plan: {
                                    model: 'games',
                                    intent: 'manage',
                                    entryId: game.id,
                                    fields: [],
                                    visibleFields: [],
                                    values: {},
                                    publishAt: '',
                                    timeZone: request.timeZone,
                                    datePurpose: 'none',
                                    dateIncomplete: false,
                                    query: '',
                                    results: [],
                                    total: 0,
                                },
                            },
                        ],
                    },
                })
            })
            await page
                .getByRole('textbox', { name: 'Content request', exact: true })
                .fill('Edit game metrics')
            const gameEditor = page.locator('[data-composer-item]')
            await gameEditor.getByRole('button', { name: 'Open editor', exact: true }).click()
            await page
                .getByRole('dialog')
                .getByLabel('Label', { exact: true })
                .first()
                .fill('Peak rank')
            await page
                .getByRole('dialog')
                .getByRole('button', { name: 'Save', exact: true })
                .click()
            await page.getByRole('dialog').waitFor({ state: 'hidden' })

            const legacy = await create(
                'ranks',
                {
                    slug: 'alias-rank',
                    game: 'Legacy game alias',
                    season: 'Earlier Act',
                    rank: 'Earlier tier',
                    image: uploadedImageId,
                    href: 'https://example.invalid/profile',
                },
                'alias-rank',
            )
            await create(
                'gameStats',
                {
                    slug: 'copied-rank',
                    game: game.id,
                    periodKey: 'earlier-act',
                    period: 'Earlier Act',
                    order: 0,
                    values: [
                        {
                            key: 'peakRank',
                            value: 2000,
                            label: 'Earlier tier',
                            image: uploadedImageId,
                            color: '#22AA66',
                        },
                    ],
                    href: 'https://example.invalid/profile',
                },
                `legacy-${legacy.id}`,
            )
            await goto(new URL('/?migration-view=' + Date.now(), url).href)
            assert.equal(
                await page.getByText('Legacy game alias', { exact: true }).count(),
                0,
                'Copied ranks do not duplicate cards when the legacy name differs from IGDB',
            )
            assert.deepEqual(errors, [])
        } catch (error) {
            server.debug()
            const page = browser?.contexts()[0]?.pages()[0]
            if (page) {
                await page.screenshot({ path: '.tmp/composer-error.png', fullPage: true })
                console.log((await page.locator('body').innerText()).slice(0, 3000))
                console.log(
                    await page.locator('input,textarea').evaluateAll((inputs) =>
                        inputs.map((input) => ({
                            id: input.id,
                            labels: Array.from((input as HTMLInputElement).labels ?? []).map(
                                (label) => label.textContent,
                            ),
                            name: input.getAttribute('name'),
                        })),
                    ),
                )
                console.log(errors)
            }
            throw error
        } finally {
            await browser?.close()
            await server.close()
        }
    },
    180000,
)

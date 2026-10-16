import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { chromium } from 'playwright-core'
import { test } from 'vitest'
import { createTestHarness } from 'wrangler'

import { defaultComposerSpec, type ComposerPlan } from '../../shared/utils/adminComposer'
import { baselineStatements } from '../helpers/database'

test.runIf(process.env.LIRY24_TEST_ADMIN_COMPOSER_BROWSER === 'true')(
    'composer preserves input, saves explicitly and hands posts to the editor',
    async () => {
        await mkdir('.tmp', { recursive: true })
        const config = JSON.parse(await readFile('.void-wrangler.jsonc', 'utf8'))
        config.name = 'composer-browser-test'
        config.main = resolve('.output/server/index.mjs')
        config.assets = { binding: 'ASSETS', directory: resolve('.output/public') }
        config.vars = {
            ...config.vars,
            APP_ENV: 'test',
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
            browser = await chromium.launch({ channel: 'chrome', headless: true })
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
            let calls = 0,
                writes = 0
            page.on('request', (request) => {
                if (request.method() !== 'GET' && request.url().includes('/api/site-admin/'))
                    writes++
            })
            await page.route('**/api/admin/compose', async (route) => {
                calls++
                const request = route.request().postDataJSON()
                const model = request.prompt.startsWith('new post') ? 'posts' : 'socials'
                const fields =
                    model === 'posts'
                        ? [
                              { key: 'title', label: 'Title', kind: 'text', required: true },
                              { key: 'tags', label: 'Tags', kind: 'array', required: true },
                          ]
                        : [
                              { key: 'href', label: 'URL', kind: 'url', required: true },
                              { key: 'label', label: 'Label', kind: 'text', required: true },
                              { key: 'icon', label: 'Icon', kind: 'text', required: true },
                              { key: 'slug', label: 'Slug', kind: 'text' },
                          ]
                const plan: ComposerPlan = {
                    model,
                    intent: request.entryId ? 'edit' : 'create',
                    entryId: request.entryId,
                    fields,
                    visibleFields:
                        model === 'posts' && request.prompt === 'new post'
                            ? ['title']
                            : fields.map((field) => field.key),
                    datePurpose:
                        request.prompt === 'new post with schedule' ? 'publication' : 'none',
                    values:
                        model === 'posts'
                            ? { title: 'Prepared post', tags: ['vue', 'nuxt'] }
                            : request.entryId
                              ? {}
                              : {
                                    href: 'https://github.com/example',
                                    label:
                                        request.prompt === 'second'
                                            ? 'Another suggestion'
                                            : 'GitHub',
                                    icon: 'simple-icons:github',
                                },
                    publishAt:
                        request.prompt === 'new post with schedule' ? '2027-01-20T18:00' : '',
                    timeZone: request.timeZone,
                    dateIncomplete: false,
                    query: '',
                    results: [],
                    total: 0,
                }
                await route.fulfill({
                    contentType: 'application/x-ndjson',
                    body:
                        JSON.stringify({ type: 'plan', plan }) +
                        '\n' +
                        JSON.stringify({
                            type: 'complete',
                            spec: defaultComposerSpec(plan),
                            fallback: false,
                        }) +
                        '\n',
                })
            })
            const html = await (await server.fetch('/admin', { headers: { cookie } })).text()
            assert.match(
                html,
                /<input[^>]*id="admin-compose-input"/,
                'The input must be server rendered',
            )
            for (const text of [
                'What would you like to do?',
                'Create, find, or',
                'Changes are saved',
            ])
                assert(!html.includes(text), 'Unnecessary composer copy is absent')
            const noJsContext = await browser.newContext({ javaScriptEnabled: false })
            await noJsContext.addCookies(await context.cookies())
            const noJsPage = await noJsContext.newPage()
            await noJsPage.goto(new URL('/admin', url).href)
            assert(await noJsPage.getByRole('textbox', { name: 'Content request' }).isVisible())
            await noJsContext.close()
            let releaseModels!: () => void
            const modelsGate = new Promise<void>((resolve) => {
                releaseModels = resolve
            })
            let modelRequests = 0
            await page.route('**/api/site-admin/models**', async (route) => {
                modelRequests++
                await modelsGate
                await route.continue()
            })
            await page.goto(new URL('/admin', url).href, { waitUntil: 'domcontentloaded' })
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
            await page.getByLabel('Content request').fill('second')
            await page.getByText('Preparing…', { exact: true }).waitFor({ state: 'hidden' })
            assert.equal(await page.getByLabel('Label', { exact: true }).inputValue(), 'My GitHub')
            assert.equal(writes, 0, 'Inference must not mutate content')
            assert.equal(modelRequests, 1, 'Navigation and form reuse one models request')
            await page.screenshot({ path: '.tmp/composer-desktop.png', fullPage: true })
            let releaseSave!: () => void
            const saveGate = new Promise<void>((resolve) => {
                releaseSave = resolve
            })
            await page.route('**/api/site-admin/entries/socials', async (route) => {
                await saveGate
                await route.continue()
            })
            await page.getByRole('button', { name: 'Save', exact: true }).click()
            await page.waitForFunction(
                () =>
                    (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties
                        .$nuxt.payload.state['$sadmin-composer-busy'] === true,
            )
            assert(await page.getByLabel('Content request').isDisabled())
            await page.keyboard.press('Control+k')
            assert.equal(await page.getByRole('dialog').count(), 0, 'Saving keeps its form mounted')
            await page.getByRole('link', { name: 'Works', exact: true }).click()
            assert.equal(new URL(page.url()).pathname, '/admin', 'Navigation waits for the save')
            releaseSave()
            await page.getByText('Saved', { exact: true }).waitFor()
            assert.equal(writes, 1, 'Saving is explicit')
            await page.getByLabel('Content request').fill('new post')
            await page.getByRole('button', { name: 'Continue in Post Editor' }).waitFor()
            assert.equal(await page.getByLabel('Title', { exact: true }).count(), 1)
            assert.equal(await page.getByText('Publication schedule', { exact: true }).count(), 0)
            assert.equal(await page.getByLabel('Tags', { exact: true }).count(), 0)
            const entries = await server.fetch('/api/site-admin/entries?model=socials&locale=ja', {
                headers: { cookie },
            })
            assert.equal(entries.status, 200)
            assert.equal(((await entries.json()) as any).items[0].data.label, 'My GitHub')
            await page.goto(new URL('/admin/posts/new', url).href, {
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
                return Object.values(state['$ssite-admin:form-drafts'] ?? {}).some(
                    (draft: any) => draft.value.title === 'Existing unsaved title',
                )
            })
            await page.getByRole('link', { name: 'Admin home', exact: true }).click()
            await page.getByLabel('Content request').fill('new post with schedule')
            await page.getByRole('button', { name: 'Continue in Post Editor' }).click()
            await page.waitForURL('**/admin/posts/new')
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Existing unsaved title',
            )
            await page.getByRole('button', { name: 'Apply prepared values' }).click()
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Prepared post',
            )
            assert.equal(
                await page.getByLabel('Content', { exact: true }).inputValue(),
                'Existing unsaved body',
            )
            assert.equal(
                await page.getByLabel('Publish at', { exact: true }).inputValue(),
                '2027-01-20T18:00',
            )
            await page.getByRole('button', { name: 'Compose content', exact: true }).click()
            await page.getByRole('dialog').waitFor()
            await page.keyboard.press('Escape')
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            await page.keyboard.press('Control+k')
            await page.getByRole('dialog').waitFor()
            await page.getByRole('dialog').getByLabel('Content request').waitFor()
            assert.equal(await page.locator('#admin-compose-input').count(), 1)
            await page.keyboard.press('Escape')
            await page.getByRole('dialog').waitFor({ state: 'hidden' })
            await page.setViewportSize({ width: 390, height: 844 })
            await page.goto(new URL('/admin', url).href, { waitUntil: 'domcontentloaded' })
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
            assert.equal(writes, 1)
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
    120000,
)

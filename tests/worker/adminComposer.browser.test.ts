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
                        contentType: 'application/x-ndjson',
                        body:
                            JSON.stringify({
                                type: 'batch',
                                batch: {
                                    requestId: request.requestId,
                                    items: plans.map((plan, i) => ({
                                        id: request.requestId + '.' + i,
                                        source: { start: 0, end: request.prompt.length },
                                        plan,
                                        spec: defaultComposerSpec(plan),
                                    })),
                                },
                            }) + '\n',
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
            await page.getByRole('link', { name: 'Admin home', exact: true }).click()
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
                await server.fetch('/api/site-admin/entries?model=socials&locale=ja', {
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
            await page.getByRole('button', { name: 'Compose content', exact: true }).click()
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
            await page.getByRole('button', { name: 'Compose content', exact: true }).click()
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
            await page.getByRole('link', { name: 'Posts', exact: true }).click()
            await page.getByRole('button', { name: /^New Post/ }).click()
            assert.equal(
                await page.getByLabel('Title', { exact: true }).inputValue(),
                'Existing unsaved title',
            )
            assert.equal(
                await page.getByLabel('Content', { exact: true }).inputValue(),
                'Existing unsaved body',
            )
            await page.getByRole('link', { name: 'Admin home', exact: true }).click()
            await page.getByLabel('Content request').fill('batch partial')
            await page
                .locator('[data-composer-item]')
                .nth(1)
                .getByRole('button', { name: 'Save', exact: true })
                .waitFor()
            let attempts = 0
            await page.route('**/api/site-admin/entries/socials', async (route) => {
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
            assert.equal(writes, 6)
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

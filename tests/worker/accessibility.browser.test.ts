import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { chromium } from 'playwright-core'
import type { Browser, Cookie, Locator, Page } from 'playwright-core'
import { expect, test } from 'vitest'
import { z } from 'zod'

import { gameFieldsSchema, mediaReferenceSchema } from '../../shared/utils/contentSchemas'
import { scanAccessibility, waitForNuxtReady } from '../helpers/accessibility'
import { builtWorker } from '../helpers/builtWorker'

interface FormSeedPayload {
    id?: string
    data: object
    body?: string
}

const artworkTitle = 'Accessibility artwork'
const artworkPath = '/arts?open=accessibility-artwork'
const postPath = '/posts/synthetic-game-mention'
const attachedProfile = 'https://example.invalid/apex'

async function multipartRequest(
    form: FormData,
    headers: Record<string, string>,
): Promise<{ headers: Record<string, string>; body: Uint8Array }> {
    const serialized = new Request('http://multipart.invalid', { method: 'POST', body: form })
    const contentType = serialized.headers.get('content-type')
    return {
        headers: contentType ? { ...headers, 'content-type': contentType } : headers,
        body: new Uint8Array(await serialized.arrayBuffer()),
    }
}

function toPlaywrightCookies(cookieHeader: string, url: URL): Array<Cookie> {
    const isHttps = url.protocol === 'https:'
    const result: Array<Cookie> = []
    for (const pair of cookieHeader.split('; ')) {
        const sep = pair.indexOf('=')
        if (sep <= 0) continue

        const name = pair.slice(0, sep)
        if (!isHttps && name.startsWith('__Secure-')) continue

        result.push({
            name,
            value: pair.slice(sep + 1),
            domain: url.hostname,
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: isHttps,
            sameSite: 'Lax',
        })
    }
    return result
}

function artworkControls(page: Page) {
    const card = page.getByRole('button').filter({
        has: page.getByRole('img', { name: artworkTitle, exact: true }),
    })
    const dialog = page.getByRole('dialog', { name: artworkTitle, exact: true })
    const enlarge = dialog.getByTestId('enlarge-artwork')
    const image = page.getByRole('dialog').filter({ hasNot: page.getByTestId('enlarge-artwork') })
    return { card, dialog, enlarge, image }
}

const gameStatsTrigger = (page: Page) =>
    page.getByRole('main').getByRole('button').and(page.locator('[aria-haspopup="dialog"]'))
const reorderHandle = (entry: Locator) => entry.locator('button[aria-pressed]')

async function expectFocus(locator: Locator) {
    await expect
        .poll(() => locator.evaluate((element) => element === document.activeElement))
        .toBe(true)
}

async function expectCenteredDialog(dialog: Locator) {
    expect(
        await dialog.evaluate((element) => {
            const bounds = element.getBoundingClientRect()
            return (
                Math.abs(bounds.left - (innerWidth - bounds.right)) < 3 &&
                Math.abs(bounds.top - (innerHeight - bounds.bottom)) < 3
            )
        }),
    ).toBe(true)
}

async function exerciseIconPicker(page: Page) {
    const add = page.getByRole('button', { name: 'Add', exact: true })
    expect(await add.getAttribute('aria-keyshortcuts')).toBe('N')
    await page.keyboard.press('n')
    const entry = page.getByRole('dialog', { name: 'New skill' })
    const name = entry.getByLabel('Name', { exact: true })
    await name.waitFor()
    await name.press('n')
    expect(await name.inputValue()).toBe('n')
    const find = entry.getByRole('button', { name: 'Find icon' })
    await find.click()
    const picker = page.getByRole('dialog', { name: 'Choose an icon' })
    await expectCenteredDialog(picker)
    const keywords: Array<string> = []
    const iconSearch = 'https://api.iconify.design/search?*'
    await page.route(iconSearch, (route) => {
        const word = new URL(route.request().url()).searchParams.get('query') ?? ''
        keywords.push(word)
        return route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: { icons: word === 'hom' ? ['lucide:house'] : ['mingcute:home-2-line'] },
        })
    })
    try {
        const weightRequest = page.waitForResponse(
            (response) => new URL(response.url()).pathname.endsWith('.bin') && response.ok(),
        )
        await picker.getByRole('combobox', { name: 'Search Iconify icons' }).fill('hom')
        await weightRequest
        const result = picker.getByRole('option', { name: 'mingcute:home-2-line' })
        await result.waitFor()
        expect(keywords[0]).toBe('hom')
        expect(keywords).toContain('house')
        await result.click()
        await picker.waitFor({ state: 'hidden' })
        expect(await entry.getByLabel('Icon', { exact: true }).inputValue()).toBe(
            'mingcute:home-2-line',
        )
        await expectFocus(find)
    } finally {
        await page.unroute(iconSearch)
    }
    await page.keyboard.press('Escape')
    await entry.waitFor({ state: 'hidden' })
    await expectFocus(add)
}

async function exerciseStatsEditor(page: Page) {
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New stat period' })
    const game = dialog.getByLabel('Game', { exact: true })
    await game.selectOption('igdb-126459')
    await expectCenteredDialog(dialog)
    await dialog.getByLabel('Period label', { exact: true }).fill('New synthetic period')
    await dialog.getByLabel('Period key', { exact: true }).fill('new-synthetic-period')

    const peak = dialog.getByRole('textbox', { name: 'Peak Rank', exact: true })
    await peak.fill('1.5')
    const save = dialog.getByRole('button', { name: 'Save draft' })
    await save.click()
    await dialog
        .getByText('Enter a non-negative whole number within the safe integer range.')
        .waitFor()
    await peak.fill('0')
    await game.selectOption('igdb-114795')
    const rank = dialog.getByRole('textbox', { name: 'Rank', exact: true })
    expect(await rank.inputValue()).toBe('')
    await rank.fill('7')
    await game.selectOption('igdb-126459')
    expect(await peak.inputValue()).toBe('0')

    const [response] = await Promise.all([
        page.waitForResponse(
            (entry) => new URL(entry.url()).pathname === '/_vitehub/forms/game-stats',
        ),
        save.click(),
    ])
    expect(response.status()).toBe(201)
    expect(response.request().postDataJSON()).toMatchObject({
        data: { game: 'igdb-126459', values: [{ key: 'rank', value: 0 }] },
    })
    await dialog.waitFor({ state: 'hidden' })
    const saved = page.locator('[data-item-id="igdb-126459-new-synthetic-period"]')
    await saved.getByTestId('edit-entry').click()
    const edit = page.getByRole('dialog', { name: 'Edit stat period' })
    expect(await edit.getByRole('textbox', { name: 'Peak Rank', exact: true }).inputValue()).toBe(
        '0',
    )
    await page.keyboard.press('Escape')
    await edit.waitFor({ state: 'hidden' })
}

async function exerciseArtworkEditor(page: Page, bytes: Buffer) {
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New artwork' })
    const upload = '**/api/admin/media'
    await page.route(upload, (route) =>
        route.request().postDataBuffer()?.includes('rejected-art.png')
            ? route.fulfill({ status: 400, json: { message: 'Synthetic upload failure' } })
            : route.continue(),
    )
    try {
        const files = ['first-art.png', 'rejected-art.png', 'last-art.png']
        await dialog
            .locator('input[type=file]')
            .setInputFiles(files.map((name) => ({ name, mimeType: 'image/png', buffer: bytes })))
        await dialog
            .getByRole('alert')
            .getByText(/rejected-art.png/)
            .waitFor()
        const image = dialog.getByRole('img', { name: 'Gallery images 1' })
        expect(await image.getAttribute('src')).toMatch(/first-art\.png$/u)
        await dialog.getByRole('button', { name: 'Move image 2 earlier' }).click()
        expect(await image.getAttribute('src')).toMatch(/last-art\.png$/u)
        await dialog.getByRole('button', { name: 'Remove image 2' }).click()
        expect(await dialog.getByRole('img').count()).toBe(1)
        await dialog.getByRole('textbox', { name: 'Title' }).fill('Synthetic new artwork')
        await dialog.getByRole('button', { name: 'Use synthetic-new-artwork' }).click()
        const [saved] = await Promise.all([
            page.waitForResponse(
                (entry) => new URL(entry.url()).pathname === '/_vitehub/forms/art',
            ),
            dialog.getByRole('button', { name: 'Save draft' }).click(),
        ])
        expect(saved.status()).toBe(201)
        expect(saved.request().postDataJSON()).toMatchObject({
            data: { images: [{ pathname: expect.stringMatching(/last-art\.png$/u) }] },
        })
        await dialog.waitFor({ state: 'hidden' })
    } finally {
        await page.unroute(upload)
    }
}

async function exerciseReorder(page: Page) {
    const entries = page.getByRole('main').locator('[data-item-id]')
    const order = () =>
        entries.evaluateAll((items) => items.map((item) => item.getAttribute('data-item-id')))
    const firstEntry = page.locator('[data-item-id="typescript"]')
    const secondEntry = page.locator('[data-item-id="vue"]')
    const firstHandle = reorderHandle(firstEntry)
    const secondHandle = reorderHandle(secondEntry)
    const initialOrder = ['typescript', 'vue']
    const reversedOrder = ['vue', 'typescript']

    await firstHandle.press('Space')
    await firstHandle.press('ArrowDown')
    await expect.poll(order).toEqual(reversedOrder)
    await firstHandle.press('Escape')
    await expect.poll(order).toEqual(initialOrder)
    await expectFocus(firstHandle)

    await secondEntry.locator('button[data-direction="up"]').click()
    await expect.poll(order).toEqual(reversedOrder)
    await secondHandle.scrollIntoViewIfNeeded()
    await firstEntry.scrollIntoViewIfNeeded()
    const source = await secondHandle.boundingBox()
    const target = await firstEntry.boundingBox()
    if (!source || !target) throw new Error('Missing reorder source or target')

    const x = source.x + source.width / 2
    await page.mouse.move(x, source.y + source.height / 2)
    await page.mouse.down()
    await page.mouse.move(x, target.y + target.height * 0.75, { steps: 12 })
    await page.mouse.up()
    await expect.poll(order).toEqual(initialOrder)

    await firstHandle.press('Space')
    await firstHandle.press('ArrowDown')
    await firstHandle.press('Space')
    await page.getByTestId('save-order').click()
    await page.getByTestId('save-order').waitFor({ state: 'hidden' })
    await page.reload()
    await waitForNuxtReady(page)
    await expect.poll(order).toEqual(reversedOrder)
}

test.runIf(process.env.LIRY24_TEST_ACCESSIBILITY_BROWSER === 'true')(
    'public and admin UI meet WCAG 2.2 A/AA, mobile navigation, and reduced-motion requirements',
    async () => {
        const app = await builtWorker({ env: { NUXT_PUBLIC_IMAGES_DOMAIN: '' } })
        let browser: Browser | undefined
        const errors: Array<string> = []
        const observeErrors = (page: Page, label = '') => {
            page.on('pageerror', (error) => {
                errors.push(`${label}${page.url()}: ${error.message}`)
            })
            page.on('console', (message) => {
                const text = message.text()
                if (/hydration.*mismatch|non-element root|NUXT_E400[23]/i.test(text))
                    errors.push(`${label}${page.url()}: ${text}`)
            })
            page.on('response', (response) => {
                if (response.status() >= 500 && new URL(response.url()).origin === app.url.origin)
                    errors.push(`${label}${response.url()}: ${response.status()}`)
            })
        }

        try {
            const admin = await app.session('a11y-admin', 'admin', 'owner@example.invalid')
            const jsonHeaders = {
                'content-type': 'application/json',
                ...admin,
            }

            const fixtureBytes = await readFile(resolve('tests/fixtures/accessibility-artwork.png'))
            const mediaForm = new FormData()
            mediaForm.append(
                'file',
                new File([new Uint8Array(fixtureBytes)], 'accessibility-artwork.png', {
                    type: 'image/png',
                }),
            )
            mediaForm.append('folder', 'arts')
            const uploadResponse = await app.server.fetch('/api/admin/media', {
                method: 'POST',
                ...(await multipartRequest(mediaForm, admin)),
            })
            expect(uploadResponse.status, await uploadResponse.clone().text()).toBe(200)
            const uploadedMedia = mediaReferenceSchema.parse(await uploadResponse.json())

            const submitAndPublish = async (
                formName: string,
                collection: string,
                payload: FormSeedPayload,
            ) => {
                const saveResponse = await app.server.fetch(`/_vitehub/forms/${formName}`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(payload),
                })
                expect(saveResponse.status, await saveResponse.clone().text()).toBe(201)
                const saved = z.object({ id: z.string() }).parse(await saveResponse.json())

                const publishResponse = await app.server.fetch('/api/admin/content/publish', {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify({
                        action: 'publish',
                        collection,
                        id: saved.id,
                    }),
                })
                expect(publishResponse.status, await publishResponse.clone().text()).toBe(200)
                return saved.id
            }

            const valorantId = 'igdb-126459'
            const valorantGame = gameFieldsSchema.parse({
                igdbId: 126_459,
                slug: 'valorant',
                name: 'VALORANT',
                primaryMetric: 'rank',
                order: 0,
                metrics: [
                    {
                        key: 'rank',
                        label: 'Peak Rank',
                        format: 'integer',
                        positions: [
                            {
                                label: 'Immortal',
                                value: 2100,
                                color: '#FF4655',
                            },
                        ],
                    },
                ],
            })
            const apexId = 'igdb-114795'
            const apexGame = gameFieldsSchema.parse({
                igdbId: 114_795,
                slug: 'apex-legends',
                name: 'Apex Legends',
                primaryMetric: 'rank',
                order: 1,
                metrics: [
                    {
                        key: 'rank',
                        label: 'Rank',
                        format: 'integer',
                        positions: [],
                    },
                ],
            })
            for (const [id, game] of [
                [valorantId, valorantGame],
                [apexId, apexGame],
            ] as const) {
                await app.env.DB.prepare(
                    'INSERT INTO game_catalog (id, igdb_id, slug, data) VALUES (?, ?, ?, ?)',
                )
                    .bind(id, game.igdbId, game.slug, JSON.stringify(game))
                    .run()
            }

            await submitAndPublish('game-stats', 'gameStats', {
                data: {
                    game: valorantId,
                    periodKey: 'act-1',
                    period: 'Act 1',
                    order: 1,
                    values: [
                        {
                            key: 'rank',
                            value: 2100,
                            label: 'Immortal 1',
                            image: uploadedMedia,
                            color: '#FF4655',
                        },
                    ],
                },
            })

            await submitAndPublish('game-stats', 'gameStats', {
                data: {
                    game: apexId,
                    periodKey: 's23',
                    period: 'S23',
                    order: 0,
                    href: attachedProfile,
                    values: [
                        {
                            key: 'rank',
                            value: 22,
                            label: 'Predator',
                            image: uploadedMedia,
                        },
                    ],
                },
            })

            await submitAndPublish('art', 'arts', {
                data: {
                    title: artworkTitle,
                    slug: 'accessibility-artwork',
                    images: [uploadedMedia],
                    description: 'Synthetic artwork for accessibility audit.',
                    order: 0,
                },
            })

            await submitAndPublish('work', 'works', {
                data: {
                    title: 'Accessibility large work',
                    slug: 'accessibility-large-work',
                    style: 'large',
                    category: 'Tooling',
                    description: 'Synthetic work for accessibility audit.',
                    image: uploadedMedia,
                    href: 'https://example.invalid/work',
                    order: 0,
                },
            })

            await submitAndPublish('skill', 'skills', {
                id: 'typescript',
                data: {
                    name: 'TypeScript',
                    slug: 'typescript',
                    icon: 'simple-icons:typescript',
                    category: 'Language',
                    order: 0,
                },
            })

            await submitAndPublish('skill', 'skills', {
                id: 'vue',
                data: {
                    name: 'Vue',
                    slug: 'vue',
                    icon: 'simple-icons:vuedotjs',
                    category: 'Framework',
                    order: 1,
                },
            })

            await submitAndPublish('post', 'posts', {
                id: 'synthetic-game-mention',
                data: {
                    title: 'Played :game[valorant]',
                    plainTitle: 'Played VALORANT',
                    slug: 'synthetic-game-mention',
                    summary: 'Synthetic summary with game mention.',
                    tags: ['dev'],
                    gameMentions: [],
                    order: 0,
                },
                body: 'Summary paragraph with :game[valorant].\n\n<!-- more -->\n\nFull synthetic article body with :game[valorant].',
            })

            browser = await chromium.launch({ headless: true })
            const sessionCookies = toPlaywrightCookies(admin.cookie, app.url)
            const violations: Array<Awaited<ReturnType<typeof scanAccessibility>>[number]> = []

            for (const colorScheme of ['light', 'dark'] as const) {
                await app.env.DB.prepare('DELETE FROM rate_limit').run()
                const auditContext = await browser.newContext({
                    colorScheme,
                    viewport: { width: 1280, height: 900 },
                })
                await auditContext.route('**/*', (route) =>
                    new URL(route.request().url()).origin === app.url.origin
                        ? route.continue()
                        : route.abort(),
                )
                await auditContext.addCookies(sessionCookies)
                const auditPage = await auditContext.newPage()
                observeErrors(auditPage, `${colorScheme} `)

                const waitForTheme = () =>
                    auditPage.waitForFunction(
                        (theme) => document.documentElement.classList.contains(theme),
                        colorScheme,
                    )
                const visit = async (path: string, status = 200) => {
                    const url = new URL(path, app.url).href
                    const response = await auditPage.goto(url)
                    expect(response?.status(), path).toBe(status)
                    expect(auditPage.url()).toBe(url)
                    await waitForNuxtReady(auditPage)
                    await waitForTheme()
                }

                const scan = async (state: string, expectedErrorStatus?: number) => {
                    const width = auditPage.viewportSize()?.width ?? 1280
                    violations.push(
                        ...(await scanAccessibility(
                            auditPage,
                            `${colorScheme}-${width}-${state}`,
                            expectedErrorStatus,
                        )),
                    )
                }

                const scanArtViewer = async () => {
                    const { card, dialog, enlarge, image } = artworkControls(auditPage)
                    await card.click()
                    await dialog.waitFor()
                    await scan('arts-viewer')
                    const fitsViewport = await dialog.evaluate((element) => {
                        const bounds = element.getBoundingClientRect()
                        return (
                            bounds.left >= 0 &&
                            bounds.right <= innerWidth &&
                            element.scrollWidth <= element.clientWidth
                        )
                    })
                    expect(fitsViewport, 'The artwork dialog stays within the viewport').toBe(true)

                    await enlarge.click()
                    await image.waitFor()
                    await scan('image-viewer')
                    await auditPage.keyboard.press('Escape')
                    await image.waitFor({ state: 'hidden' })
                    await auditPage.keyboard.press('Escape')
                    await dialog.waitFor({ state: 'hidden' })
                }

                await visit('/')
                const stats = gameStatsTrigger(auditPage)
                await stats.waitFor()
                await auditPage
                    .locator('a[href="' + attachedProfile + '"]')
                    .getByRole('img')
                    .waitFor()
                await scan('home')

                const dialog = auditPage.getByRole('dialog')
                if (colorScheme === 'light') {
                    const konamiPrefix = [
                        'ArrowUp',
                        'ArrowUp',
                        'ArrowDown',
                        'ArrowDown',
                        'ArrowLeft',
                        'ArrowRight',
                        'ArrowLeft',
                        'ArrowRight',
                        'b',
                    ]
                    for (const key of [...konamiPrefix, 'a']) await auditPage.keyboard.press(key)
                    await dialog.waitFor()
                    await auditPage.mouse.click(5, 5)
                    await dialog.waitFor({ state: 'hidden' })

                    for (const key of [...konamiPrefix, 'x', 'a'])
                        await auditPage.keyboard.press(key)
                    expect(await dialog.isVisible()).toBe(false)
                }

                await stats.click()
                await dialog.getByRole('table').waitFor()
                await scan('game-stats-dialog')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

                await visit('/arts')
                await artworkControls(auditPage).card.waitFor()
                await scan('arts')
                await scanArtViewer()

                await visit('/works')
                await auditPage.locator('a[href="https://example.invalid/work"]').waitFor()
                await scan('works')

                await visit('/posts')
                await auditPage
                    .getByRole('link')
                    .and(auditPage.locator('a[href="' + postPath + '"]'))
                    .waitFor()
                await scan('posts')
                await visit(postPath)
                await auditPage
                    .getByRole('heading', { level: 1 })
                    .locator('a[href="/posts?game=valorant"]')
                    .waitFor()
                await scan('post-detail')

                await auditContext.clearCookies()
                await visit('/admin?pocket-id-error=1', 403)
                await auditPage
                    .getByRole('link')
                    .and(auditPage.locator('a[href="/admin"]'))
                    .waitFor()
                await scan('pocket-id-error', 403)

                await auditContext.addCookies(sessionCookies)
                await visit('/admin')
                await scan('admin')

                await visit('/admin/posts')
                await auditPage
                    .getByRole('link')
                    .and(auditPage.locator('a[href="/admin' + postPath + '"]'))
                    .first()
                    .waitFor()
                await scan('admin-posts')

                await visit('/admin/posts/new')
                const editor = auditPage.getByRole('main')
                const saveDraft = editor.getByTestId('save-post-draft')
                await saveDraft.waitFor()
                await scan('post-editor')

                const [validation] = await Promise.all([
                    auditPage.waitForResponse(
                        (response) =>
                            new URL(response.url()).pathname === '/_vitehub/forms/post' &&
                            response.request().method() === 'POST',
                    ),
                    saveDraft.click(),
                ])
                expect(validation.status()).toBe(400)
                await editor.getByRole('alert').first().waitFor()
                await scan('post-validation')

                await visit('/admin/skills')
                const skill = auditPage.locator('[data-item-id="typescript"]')
                await skill.waitFor()
                await scan('admin-skills')
                await skill.getByTestId('edit-entry').click()
                await dialog.getByRole('textbox').first().waitFor()
                await scan('entry-edit-dialog')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })
                if (colorScheme === 'light') await exerciseIconPicker(auditPage)

                await auditPage.getByTestId('toggle-reorder').click()
                await reorderHandle(skill).waitFor()
                await auditPage.keyboard.press('n')
                expect(await dialog.isVisible()).toBe(false)
                await scan('admin-skills-reorder')
                if (colorScheme === 'light') await exerciseReorder(auditPage)

                await visit('/admin/gameStats')
                if (colorScheme === 'light') await exerciseStatsEditor(auditPage)
                await auditPage.getByRole('button', { name: 'Add', exact: true }).click()
                await dialog.getByLabel('Game', { exact: true }).selectOption('igdb-126459')
                await scan('admin-stat-editor')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

                if (colorScheme === 'light') {
                    await visit('/admin/arts')
                    await exerciseArtworkEditor(auditPage, fixtureBytes)
                }

                await visit('/admin/careers')
                await scan('admin-careers-empty')

                await visit('/admin/assistant')
                await auditPage.getByRole('main').getByRole('textbox').waitFor()
                await scan('admin-assistant')

                await visit('/admin/settings')
                await auditPage.locator('#sessions li').first().waitFor()
                await scan('admin-settings')

                await auditPage.setViewportSize({ width: 390, height: 844 })
                await visit('/admin/gameStats')
                await auditPage.getByRole('button', { name: 'Add', exact: true }).click()
                await dialog.getByLabel('Game', { exact: true }).selectOption('igdb-126459')
                await expectCenteredDialog(dialog)
                await scan('admin-stat-editor')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

                await visit('/')
                await stats.waitFor()
                await scan('home')

                await visit('/arts')
                await scanArtViewer()

                await visit(postPath)
                await scan('post-detail')

                await visit('/admin/posts/new')
                await scan('post-editor')
                await editor.locator('button[data-slot="toggle"][aria-expanded="false"]').click()
                await dialog.locator('a[href="/admin/skills"]').waitFor()
                await scan('admin-navigation')

                await auditContext.close()
            }

            for (const reducedMotion of ['no-preference', 'reduce'] as const) {
                const motionContext = await browser.newContext({
                    reducedMotion,
                    viewport: { width: 1280, height: 900 },
                })
                await motionContext.route('**/*', (route) =>
                    new URL(route.request().url()).origin === app.url.origin
                        ? route.continue()
                        : route.abort(),
                )
                await motionContext.addCookies(sessionCookies)
                const motionPage = await motionContext.newPage()
                observeErrors(motionPage, `${reducedMotion} `)

                const settled = async (path: string) => {
                    await motionPage.waitForURL(new URL(path, app.url).href)
                    await waitForNuxtReady(motionPage)
                }

                await motionPage.goto(new URL('/arts', app.url).href)
                await settled('/arts')

                const { card, dialog, enlarge, image } = artworkControls(motionPage)
                await card.press('Enter')
                await dialog.waitFor()
                await enlarge.press('Enter')
                await image.waitFor()
                await motionPage.keyboard.press('Escape')
                await image.waitFor({ state: 'hidden' })
                await expectFocus(enlarge)

                await motionPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })
                await expectFocus(card)

                await motionPage.goto(new URL(artworkPath, app.url).href)
                await settled(artworkPath)
                await dialog.waitFor()
                await motionPage.evaluate(() => history.back())
                await dialog.waitFor({ state: 'hidden' })

                await motionPage.goto(new URL('/admin', app.url).href)
                await settled('/admin')
                const publicSite = motionPage.getByRole('navigation').locator('a[href="/"]')
                await publicSite.click()
                await settled('/')
                await gameStatsTrigger(motionPage).waitFor()
                await motionPage.goBack()
                await settled('/admin')
                await publicSite.waitFor()
                await motionPage.goForward()
                await settled('/')
                await gameStatsTrigger(motionPage).waitFor()

                await motionContext.close()
            }

            expect(violations, 'WCAG 2.2 A/AA violations; see .tmp/accessibility').toEqual([])
            expect(errors).toEqual([])
        } catch (error) {
            const page = browser?.contexts().at(-1)?.pages().at(-1)
            if (page) {
                await mkdir('.tmp/accessibility', { recursive: true })
                await page.screenshot({
                    path: '.tmp/accessibility/browser-error.png',
                    fullPage: true,
                })
                await writeFile(
                    '.tmp/accessibility/browser-error.json',
                    JSON.stringify(
                        {
                            url: page.url(),
                            error: String(error),
                            browserErrors: errors,
                        },
                        null,
                        2,
                    ),
                )
            }
            throw error
        } finally {
            await browser?.close()
            await app.close()
        }
    },
    600_000,
)

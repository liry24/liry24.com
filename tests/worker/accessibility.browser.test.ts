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

                await auditPage.getByTestId('toggle-reorder').click()
                await reorderHandle(skill).waitFor()
                await scan('admin-skills-reorder')
                if (colorScheme === 'light') await exerciseReorder(auditPage)

                await visit('/admin/careers')
                await scan('admin-careers-empty')

                await visit('/admin/assistant')
                await auditPage.getByRole('main').getByRole('textbox').waitFor()
                await scan('admin-assistant')

                await visit('/admin/settings')
                await auditPage.locator('#sessions li').first().waitFor()
                await scan('admin-settings')

                await auditPage.setViewportSize({ width: 390, height: 844 })
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

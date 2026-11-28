import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import { expect, test } from 'vitest'

import { scanAccessibility, waitForNuxtReady } from '../helpers/accessibility'
import { builtWorker } from '../helpers/builtWorker'
import {
    ARTWORK_PATH,
    ARTWORK_TITLE,
    ATTACHED_PROFILE,
    POST_PATH,
    VALORANT_IGDB_COVER,
    VALORANT_IGDB_THUMB,
    expectFocus,
    observeBrowserErrors,
    seedBrowserFixtures,
    toPlaywrightCookies,
} from '../helpers/workerSeed'

function artworkControls(page: Page) {
    const card = page.getByRole('button').filter({
        has: page.getByRole('img', { name: ARTWORK_TITLE, exact: true }),
    })
    const dialog = page.getByRole('dialog', { name: ARTWORK_TITLE, exact: true })
    const enlarge = dialog.getByTestId('enlarge-artwork')
    const image = page.getByRole('dialog').filter({ hasNot: page.getByTestId('enlarge-artwork') })
    return { card, dialog, enlarge, image }
}

const WORK_TITLE = 'Accessibility large work'

function workControls(page: Page) {
    const card = page.getByRole('button').filter({
        has: page.getByRole('heading', { name: WORK_TITLE, exact: true }),
    })
    const dialog = page.getByRole('dialog', { name: WORK_TITLE, exact: true })
    const enlarge = dialog.getByTestId('enlarge-work-image')
    const image = page
        .getByRole('dialog')
        .filter({ hasNot: page.getByTestId('enlarge-work-image') })
    return { card, dialog, enlarge, image }
}

const gameStatsTrigger = (page: Page, name = 'VALORANT') =>
    page
        .getByRole('main')
        .getByRole('button', { name: new RegExp(name, 'i') })
        .and(page.locator('[aria-haspopup="dialog"]'))

test.runIf(process.env.LIRY24_TEST_ACCESSIBILITY_BROWSER === 'true')(
    'public and admin UI meet WCAG 2.2 A/AA, mobile navigation, and reduced-motion requirements',
    async () => {
        const app = await builtWorker({ env: { NUXT_PUBLIC_IMAGES_DOMAIN: '' } })
        let browser: Browser | undefined
        const errors: Array<string> = []

        try {
            const admin = await app.session('a11y-admin', 'admin', 'owner@example.invalid')
            const { fixtureBytes } = await seedBrowserFixtures(app, admin)

            browser = await chromium.launch({ headless: true })
            const sessionCookies = toPlaywrightCookies(admin.cookie, app.url)
            const violations: Array<Awaited<ReturnType<typeof scanAccessibility>>[number]> = []

            for (const colorScheme of ['light', 'dark'] as const) {
                await app.env.DB.prepare('DELETE FROM rate_limit').run()
                const auditContext = await browser.newContext({
                    colorScheme,
                    viewport: { width: 1280, height: 900 },
                })
                await auditContext.route('**/*', (route) => {
                    const url = route.request().url()
                    if (url === VALORANT_IGDB_COVER || url === VALORANT_IGDB_THUMB) {
                        return route.fulfill({
                            status: 200,
                            contentType: 'image/png',
                            body: fixtureBytes,
                        })
                    }
                    return new URL(url).origin === app.url.origin ? route.continue() : route.abort()
                })
                await auditContext.addCookies(sessionCookies)
                const auditPage = await auditContext.newPage()
                observeBrowserErrors(auditPage, app.url.origin, errors, `${colorScheme} `)

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

                const scanWorkViewer = async () => {
                    const { card, dialog, enlarge, image } = workControls(auditPage)
                    await card.click()
                    await dialog.waitFor()
                    await dialog.locator('a[href="https://example.invalid/work"]').waitFor()
                    await scan('works-viewer')
                    const fitsViewport = await dialog.evaluate((element) => {
                        const bounds = element.getBoundingClientRect()
                        return (
                            bounds.left >= 0 &&
                            bounds.right <= innerWidth &&
                            element.scrollWidth <= element.clientWidth
                        )
                    })
                    expect(fitsViewport, 'The work dialog stays within the viewport').toBe(true)

                    await enlarge.click()
                    await image.waitFor()
                    await scan('work-image-viewer')
                    await auditPage.keyboard.press('Escape')
                    await image.waitFor({ state: 'hidden' })
                    await auditPage.keyboard.press('Escape')
                    await dialog.waitFor({ state: 'hidden' })
                    await expectFocus(card)
                }

                const scanGameStatsViewer = async () => {
                    const valorant = gameStatsTrigger(auditPage, 'VALORANT')
                    const apex = gameStatsTrigger(auditPage, 'Apex Legends')
                    await valorant.waitFor()
                    await apex.waitFor()

                    const dialog = auditPage.getByRole('dialog', { name: 'VALORANT', exact: true })
                    await valorant.click()
                    await dialog.getByRole('table').waitFor()
                    await dialog.getByRole('img', { name: 'VALORANT cover', exact: true }).waitFor()
                    await dialog.getByRole('button', { name: 'Win Rate', exact: true }).click()
                    await scan('game-stats-dialog')
                    const fitsViewport = await dialog.evaluate((element) => {
                        const bounds = element.getBoundingClientRect()
                        return (
                            bounds.left >= 0 &&
                            bounds.right <= innerWidth &&
                            element.scrollWidth <= element.clientWidth
                        )
                    })
                    expect(fitsViewport, 'The game stats dialog stays within the viewport').toBe(
                        true,
                    )
                    await auditPage.keyboard.press('Escape')
                    await dialog.waitFor({ state: 'hidden' })
                    await expectFocus(valorant)

                    const apexDialog = auditPage.getByRole('dialog', {
                        name: 'Apex Legends',
                        exact: true,
                    })
                    await apex.click()
                    await apexDialog.locator(`a[href="${ATTACHED_PROFILE}"]`).first().waitFor()
                    await auditPage.keyboard.press('Escape')
                    await apexDialog.waitFor({ state: 'hidden' })
                    await expectFocus(apex)
                }

                await visit('/')
                const stats = gameStatsTrigger(auditPage)
                await stats.waitFor()
                await scan('home')
                await scanGameStatsViewer()
                const dialog = auditPage.getByRole('dialog')

                await visit('/arts')
                await artworkControls(auditPage).card.waitFor()
                await scan('arts')
                await scanArtViewer()

                await visit('/works')
                await workControls(auditPage).card.waitFor()
                await scan('works')
                await scanWorkViewer()

                await visit('/posts')
                await auditPage
                    .getByRole('link')
                    .and(auditPage.locator(`a[href="${POST_PATH}"]`))
                    .waitFor()
                await scan('posts')

                await visit(POST_PATH)
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
                    .and(auditPage.locator(`a[href="/admin${POST_PATH}"]`))
                    .first()
                    .waitFor()
                await scan('admin-posts')

                await visit('/admin/posts/new')
                const editor = auditPage.getByRole('main')
                const publishOptions = editor.getByRole('button', { name: 'Publish options' })
                await publishOptions.waitFor()
                await scan('post-editor')

                await publishOptions.click()
                await auditPage.getByRole('menuitem', { name: 'Save draft' }).click()
                await editor.getByRole('alert').first().waitFor()
                await scan('post-validation')

                await publishOptions.click()
                await auditPage.getByRole('menuitem', { name: 'Scheduled publish' }).click()
                const scheduling = auditPage.getByRole('dialog', { name: 'Scheduled publish' })
                await scheduling.getByLabel('Schedule at', { exact: true }).waitFor()
                await scan('post-schedule-dialog')
                await auditPage.keyboard.press('Escape')
                await scheduling.waitFor({ state: 'hidden' })

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
                await skill.locator('button[aria-pressed]').waitFor()
                await scan('admin-skills-reorder')

                await visit('/admin/gameStats')
                await auditPage.locator('[data-game-group="igdb-126459"]').waitFor()
                await scan('admin-game-stats')

                await auditPage.getByRole('button', { name: 'Add', exact: true }).click()
                const gameInput = dialog.getByRole('combobox', { name: 'Game', exact: true })
                await gameInput.click()
                await gameInput.fill('VALORANT')
                await auditPage
                    .getByRole('option', { name: /^VALORANT\b/i })
                    .first()
                    .click()
                await dialog.getByRole('button', { name: 'Configure' }).first().click()
                await scan('admin-stat-editor')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

                await auditPage.getByRole('button', { name: 'Edit VALORANT settings' }).click()
                await dialog.getByLabel('Metric label', { exact: true }).first().waitFor()
                await scan('admin-game-settings')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

                await auditPage.getByRole('button', { name: 'Manage games' }).click()
                await dialog.locator('[data-catalog-game-id="igdb-126459"]').waitFor()
                await scan('admin-manage-games')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

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
                const mobileGameInput = dialog.getByRole('combobox', { name: 'Game', exact: true })
                await mobileGameInput.click()
                await mobileGameInput.fill('VALORANT')
                await auditPage
                    .getByRole('option', { name: /^VALORANT\b/i })
                    .first()
                    .click()
                await scan('admin-stat-editor')
                await auditPage.keyboard.press('Escape')
                await dialog.waitFor({ state: 'hidden' })

                await visit('/')
                await stats.waitFor()
                await scan('home')
                await scanGameStatsViewer()

                await visit('/arts')
                await scanArtViewer()

                await visit('/works')
                await scanWorkViewer()

                await visit(POST_PATH)
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
                observeBrowserErrors(motionPage, app.url.origin, errors, `${reducedMotion} `)

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

                await motionPage.goto(new URL(ARTWORK_PATH, app.url).href)
                await settled(ARTWORK_PATH)
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

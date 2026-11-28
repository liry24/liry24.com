import { chromium } from 'playwright-core'
import type { Browser, Locator, Page } from 'playwright-core'
import { expect, test } from 'vitest'

import { waitForNuxtReady } from '../helpers/accessibility'
import { builtWorker } from '../helpers/builtWorker'
import {
    expectFocus,
    observeBrowserErrors,
    seedBrowserFixtures,
    toPlaywrightCookies,
} from '../helpers/workerSeed'

const reorderHandle = (entry: Locator) => entry.locator('button[aria-pressed]')

async function exerciseIconPicker(page: Page) {
    const add = page.getByRole('button', { name: 'Add', exact: true })
    expect(await add.getAttribute('aria-keyshortcuts')).toBe('N')
    await page.keyboard.press('n')
    const entry = page.getByRole('dialog', { name: 'New skill' })
    const name = entry.getByLabel('Name', { exact: true })
    await name.waitFor()
    expect(await entry.getByRole('checkbox', { name: 'Enter slug manually' }).count()).toBe(0)
    await name.press('n')
    expect(await name.inputValue()).toBe('n')
    const find = entry.getByRole('button', { name: 'Find icon' })
    await find.click()
    const picker = page.getByRole('dialog', { name: 'Choose an icon' })
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

async function chooseGameOption(dialog: Locator, page: Page, query: string, optionLabel: string) {
    const combobox = dialog.getByRole('combobox', { name: 'Game', exact: true })
    await combobox.click()
    await combobox.fill(query)
    const option = page.getByRole('option', { name: new RegExp(`^${optionLabel}\\b`, 'i') }).first()
    await option.waitFor()
    await option.click()
}

async function exerciseStatsEditor(page: Page) {
    // Grouped by game
    const valorantGroup = page.locator('[data-game-group="igdb-126459"]')
    await valorantGroup.waitFor()

    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New stat period' })
    await chooseGameOption(dialog, page, 'VALORANT', 'VALORANT')
    await dialog.getByLabel('Period label', { exact: true }).fill('New synthetic period')
    expect(await dialog.getByRole('textbox', { name: 'Period key' }).count()).toBe(0)

    const peak = dialog.getByRole('textbox', { name: 'Peak Rank', exact: true })
    await peak.fill('1.5')
    const save = dialog.getByRole('button', { name: 'Save draft' })
    await save.click()
    await dialog.getByRole('alert').first().waitFor()
    await peak.fill('0')
    await chooseGameOption(dialog, page, 'Apex', 'Apex Legends')
    const rank = dialog.getByRole('textbox', { name: 'Rank', exact: true })
    expect(await rank.inputValue()).toBe('')
    await rank.fill('7')
    await chooseGameOption(dialog, page, 'VALORANT', 'VALORANT')
    expect(await peak.inputValue()).toBe('0')

    const [response] = await Promise.all([
        page.waitForResponse(
            (entry) => new URL(entry.url()).pathname === '/_vitehub/forms/game-stats',
        ),
        save.click(),
    ])
    expect(response.status()).toBe(201)
    expect(await response.json()).toEqual({
        id: 'igdb-126459-new_synthetic_period',
        gameId: 'igdb-126459',
    })
    expect(response.request().postDataJSON()).toMatchObject({
        data: { game: 'igdb-126459', values: [{ key: 'rank', value: 0 }] },
    })
    await dialog.waitFor({ state: 'hidden' })
    const saved = page.locator('[data-item-id="igdb-126459-new_synthetic_period"]')
    await saved.getByTestId('edit-entry').click()
    const edit = page.getByRole('dialog', { name: 'Edit stat period' })
    expect(await edit.getByRole('textbox', { name: 'Peak Rank', exact: true }).inputValue()).toBe(
        '0',
    )
    await page.keyboard.press('Escape')
    await edit.waitFor({ state: 'hidden' })

    // Create a brand-new game + metric + stat period in one flow using the IGDB emulator
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await dialog.waitFor()
    await chooseGameOption(dialog, page, 'sf6', 'Street Fighter 6')
    await dialog.getByLabel('Period label', { exact: true }).fill('Act 5')
    await dialog.getByRole('button', { name: 'Add metric' }).click()
    await dialog.getByLabel('Metric label', { exact: true }).fill('Master Rate')
    await dialog.getByLabel('Unit', { exact: true }).fill('MR')
    await dialog.getByRole('textbox', { name: 'Master Rate', exact: true }).fill('1650')

    const [createdNewGame] = await Promise.all([
        page.waitForResponse(
            (entry) => new URL(entry.url()).pathname === '/_vitehub/forms/game-stats',
        ),
        dialog.getByRole('button', { name: 'Save draft' }).click(),
    ])
    expect(createdNewGame.status()).toBe(201)
    expect(await createdNewGame.json()).toEqual({
        id: 'igdb-191692-act_5',
        gameId: 'igdb-191692',
    })
    await dialog.waitFor({ state: 'hidden' })
    const sf6Group = page.locator('[data-game-group="igdb-191692"]')
    await sf6Group.waitFor()
    await sf6Group.getByText('Master Rate: 1,650 MR').waitFor()

    // Group-level "Add period" presets the game automatically
    await sf6Group.getByRole('button', { name: 'Add period' }).click()
    await dialog.waitFor()
    expect(await dialog.getByRole('combobox', { name: 'Game', exact: true }).inputValue()).toBe(
        'Street Fighter 6',
    )
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })

    // Manage games modal lists registered games without any import UI
    await page.getByRole('button', { name: 'Manage games' }).click()
    const manageDialog = page.getByRole('dialog', { name: 'Manage games' })
    await manageDialog.locator('[data-catalog-game-id="igdb-191692"]').waitFor()
    await page.keyboard.press('Escape')
    await manageDialog.waitFor({ state: 'hidden' })
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
        await dialog.getByRole('textbox', { name: 'Description' }).fill('A short description')

        const slug = dialog.getByRole('textbox', { name: 'Slug', exact: true })
        expect(await slug.count()).toBe(0)
        const manual = dialog.getByRole('checkbox', { name: 'Enter slug manually' })
        await manual.check()
        await slug.fill('custom-artwork-slug')
        await manual.uncheck()
        expect(await slug.count()).toBe(0)
        await manual.check()
        expect(await slug.inputValue()).toBe('custom-artwork-slug')
        const [saved] = await Promise.all([
            page.waitForResponse(
                (entry) => new URL(entry.url()).pathname === '/_vitehub/forms/art',
            ),
            dialog.getByRole('button', { name: 'Save draft' }).click(),
        ])
        expect(saved.status()).toBe(201)
        expect(await saved.json()).toEqual({ id: 'custom-artwork-slug' })
        expect(saved.request().postDataJSON()).toMatchObject({
            data: {
                slug: 'custom-artwork-slug',
                description: 'A short description',
                images: [{ pathname: expect.stringMatching(/last-art\.png$/u) }],
            },
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

async function exercisePostEditor(page: Page) {
    const editor = page.getByRole('main')
    const publishOptions = editor.getByRole('button', { name: 'Publish options' })
    await publishOptions.waitFor()
    expect(await editor.getByRole('button', { name: 'Save draft' }).count()).toBe(0)

    await publishOptions.click()
    const [validation] = await Promise.all([
        page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === '/_vitehub/forms/post' &&
                response.request().method() === 'POST',
        ),
        page.getByRole('menuitem', { name: 'Save draft' }).click(),
    ])
    expect(validation.status()).toBe(400)
    await editor.getByRole('alert').first().waitFor()

    const slug = editor.getByRole('textbox', { name: 'Slug', exact: true })
    expect(await slug.count()).toBe(0)
    const manual = editor.getByRole('checkbox', { name: 'Enter slug manually' })
    await manual.check()
    await slug.fill('ignored_manual_slug')
    await manual.uncheck()
    expect(await slug.count()).toBe(0)

    const tags = editor.getByRole('combobox', { name: 'Tags' })
    await editor.getByRole('button', { name: 'Show tag suggestions' }).click()
    await page.getByRole('option', { name: 'dev', exact: true }).click()
    await tags.fill('interface design')
    await tags.press('Enter')
    await editor.getByRole('button', { name: 'Remove interface design' }).waitFor()
    await editor.getByRole('button', { name: 'Remove dev', exact: true }).waitFor()

    await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Synthetic new article')
    await publishOptions.click()
    await page.getByRole('menuitem', { name: 'Scheduled publish' }).click()
    const scheduling = page.getByRole('dialog', { name: 'Scheduled publish' })
    const at = scheduling.getByLabel('Schedule at', { exact: true })
    await expectFocus(at)
    const [scheduled] = await Promise.all([
        page.waitForResponse(
            (response) => new URL(response.url()).pathname === '/api/admin/content/publish',
        ),
        scheduling.getByRole('button', { name: 'Schedule', exact: true }).click(),
    ])
    expect(scheduled.status(), await scheduled.text()).toBe(200)
    expect(scheduled.request().postDataJSON()).toMatchObject({ action: 'schedule' })
    await page.waitForURL('**/admin/posts/synthetic-new-article')
    await editor.getByText('Edit post: Synthetic new article').waitFor()
    await publishOptions.click()
    await page.getByRole('menuitem', { name: 'Scheduled publish' }).click()
    await scheduling.getByRole('button', { name: 'Cancel schedule' }).click()
    await at.waitFor()
    await page.keyboard.press('Escape')
    await scheduling.waitFor({ state: 'hidden' })
    await expectFocus(publishOptions)
}

test.runIf(process.env.LIRY24_TEST_ACCESSIBILITY_BROWSER === 'true')(
    'admin editorial flows handle icon search, entry editing, media uploads, scheduling, and reordering',
    async () => {
        const app = await builtWorker({
            env: { NUXT_PUBLIC_IMAGES_DOMAIN: '', LIRY24_IGDB_EMULATOR: 'true' },
        })
        let browser: Browser | undefined
        const errors: Array<string> = []

        try {
            const admin = await app.session('flows-admin', 'admin', 'owner@example.invalid')
            const { fixtureBytes } = await seedBrowserFixtures(app, admin)

            browser = await chromium.launch({ headless: true })
            const context = await browser.newContext({
                colorScheme: 'light',
                viewport: { width: 1280, height: 900 },
            })
            await context.route('**/*', (route) =>
                new URL(route.request().url()).origin === app.url.origin
                    ? route.continue()
                    : route.abort(),
            )
            await context.addCookies(toPlaywrightCookies(admin.cookie, app.url))
            const page = await context.newPage()
            observeBrowserErrors(page, app.url.origin, errors)

            const visit = async (path: string) => {
                const url = new URL(path, app.url).href
                const response = await page.goto(url)
                expect(response?.status(), path).toBe(200)
                await waitForNuxtReady(page)
            }

            await visit('/admin/posts/new')
            await exercisePostEditor(page)

            await visit('/admin/skills')
            const skill = page.locator('[data-item-id="typescript"]')
            await skill.getByText('TypeScript', { exact: true }).waitFor()
            expect(await skill.getByText(/^typescript$/).count()).toBe(0)
            await exerciseIconPicker(page)

            await page.getByTestId('toggle-reorder').click()
            await reorderHandle(page.locator('[data-item-id="typescript"]')).waitFor()
            await page.keyboard.press('n')
            expect(await page.getByRole('dialog').isVisible()).toBe(false)
            await exerciseReorder(page)

            await visit('/admin/gameStats')
            await exerciseStatsEditor(page)

            await visit('/admin/arts')
            await exerciseArtworkEditor(page, fixtureBytes)

            await context.close()
            expect(errors).toEqual([])
        } finally {
            await browser?.close()
            await app.close()
        }
    },
    300_000,
)

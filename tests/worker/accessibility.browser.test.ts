import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { chromium } from 'playwright-core'
import type { Browser, Cookie, Page } from 'playwright-core'
import { expect, test } from 'vitest'
import { z } from 'zod'

import { gameFieldsSchema } from '../../shared/utils/contentSchemas'
import { scanAccessibility } from '../helpers/accessibility'
import { builtWorker } from '../helpers/builtWorker'

interface NuxtGlobalInstance {
    isHydrating?: boolean
    payload?: { error?: object | string | null }
    '~transitionPromise'?: object | null
    $router?: { push(path: string): Promise<Error | void | undefined> }
}

interface FormSeedPayload {
    id?: string
    data: object
    body?: string
}

interface NuxtRootElement extends Element {
    __vue_app__?: {
        config?: {
            globalProperties?: {
                $nuxt?: NuxtGlobalInstance
            }
        }
    }
}

const uploadedMediaSchema = z.object({
    pathname: z.string(),
    contentType: z.string().optional(),
    size: z.number().optional(),
})

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
        if (sep <= 0) {
            continue
        }
        const name = pair.slice(0, sep)
        if (!isHttps && name.startsWith('__Secure-')) {
            continue
        }
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

async function waitForNuxtReady(page: Page) {
    await page.waitForFunction(() => {
        const root: NuxtRootElement | null = document.querySelector('#__nuxt')
        const nuxt = root?.__vue_app__?.config?.globalProperties?.$nuxt
        return Boolean(nuxt && nuxt.isHydrating === false && !nuxt['~transitionPromise'])
    })
}

async function readNuxtError(page: Page): Promise<string | null> {
    return page.evaluate(() => {
        const root: NuxtRootElement | null = document.querySelector('#__nuxt')
        const error = root?.__vue_app__?.config?.globalProperties?.$nuxt?.payload?.error
        return error ? JSON.stringify(error) : null
    })
}

test.runIf(process.env.LIRY24_TEST_ACCESSIBILITY_BROWSER === 'true')(
    'public and admin UI meet WCAG 2.2 A/AA, mobile navigation, and reduced-motion requirements',
    async () => {
        const app = await builtWorker({ env: { NUXT_PUBLIC_IMAGES_DOMAIN: '' } })
        let browser: Browser | undefined
        const errors: Array<string> = []
        let allowExpectedValidation400 = false

        const observeErrors = (page: Page, label = '') => {
            page.on('pageerror', (error) => {
                errors.push(`${label}${page.url()}: ${error.message}`)
            })
            page.on('console', (message) => {
                const text = message.text()
                const isHydrationOrNuxtError =
                    /hydration.*mismatch|non-element root|NUXT_E400[23]/i.test(text)
                if (isHydrationOrNuxtError) {
                    errors.push(`${label}${page.url()}: ${text}`)
                    return
                }
                if (message.type() !== 'error') {
                    return
                }
                const locationUrl = message.location().url
                if (locationUrl) {
                    try {
                        if (new URL(locationUrl).origin !== app.url.origin) {
                            return
                        }
                    } catch {
                        // Ignore unparseable location URL and check remaining filters.
                    }
                }
                if (
                    allowExpectedValidation400 &&
                    /status of 400/i.test(text) &&
                    (!locationUrl || locationUrl.includes('/_vitehub/forms/post'))
                ) {
                    return
                }
                if (/status of 403/i.test(text) && locationUrl.includes('pocket-id-error=1')) {
                    return
                }
                errors.push(`${label}${page.url()}: ${text}`)
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
            const uploadedMedia = uploadedMediaSchema.parse(await uploadResponse.json())

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
                    href: 'https://example.invalid/apex',
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
                    title: 'Accessibility artwork',
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
                data: {
                    name: 'TypeScript',
                    slug: 'typescript',
                    icon: 'simple-icons:typescript',
                    category: 'Language',
                    order: 0,
                },
            })

            await submitAndPublish('skill', 'skills', {
                data: {
                    name: 'Vue',
                    slug: 'vue',
                    icon: 'simple-icons:vuedotjs',
                    category: 'Framework',
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

                const visit = async (path: string) => {
                    await auditPage.goto(new URL(path, app.url).href)
                    await waitForNuxtReady(auditPage)
                    const applicationError = await readNuxtError(auditPage)
                    expect(
                        applicationError,
                        `Application failed at ${path}: ${applicationError}`,
                    ).toBeNull()
                    await auditPage.waitForFunction(
                        (theme) => document.documentElement.classList.contains(theme),
                        colorScheme,
                    )
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
                    await auditPage
                        .getByRole('button', { name: 'View Accessibility artwork', exact: true })
                        .click()
                    const artworkDialog = auditPage.getByRole('dialog', {
                        name: 'Accessibility artwork',
                        exact: true,
                    })
                    await artworkDialog
                        .getByRole('heading', { name: 'Accessibility artwork', level: 1 })
                        .waitFor()
                    await scan('arts-viewer')
                    const fitsViewport = await artworkDialog.evaluate((element) => {
                        const bounds = element.getBoundingClientRect()
                        return (
                            bounds.left >= 0 &&
                            bounds.right <= innerWidth &&
                            element.scrollWidth <= element.clientWidth
                        )
                    })
                    expect(fitsViewport, 'The artwork dialog stays within the viewport').toBe(true)

                    await artworkDialog
                        .getByRole('button', { name: 'Enlarge image', exact: true })
                        .click()
                    const imageDialog = auditPage.getByRole('dialog', {
                        name: 'Image preview',
                        exact: true,
                    })
                    await imageDialog.waitFor()
                    await scan('image-viewer')
                    await auditPage.keyboard.press('Escape')
                    await imageDialog.waitFor({ state: 'hidden' })
                    await artworkDialog.getByRole('button', { name: 'Close', exact: true }).click()
                    await artworkDialog.waitFor({ state: 'hidden' })
                }

                await visit('/')
                await auditPage.getByRole('button', { name: /VALORANT Act 1/ }).waitFor()
                await scan('home')
                await auditPage.getByRole('button', { name: /VALORANT Act 1/ }).click()
                await auditPage.getByRole('dialog').getByRole('table').waitFor()
                await scan('game-stats-dialog')
                await auditPage.keyboard.press('Escape')
                await auditPage.getByRole('dialog').waitFor({ state: 'hidden' })

                await visit('/arts')
                await auditPage
                    .getByRole('button', { name: 'View Accessibility artwork', exact: true })
                    .waitFor()
                await scan('arts')
                await scanArtViewer()

                await visit('/works')
                await auditPage.getByRole('heading', { name: 'Accessibility large work' }).waitFor()
                await scan('works')

                for (const path of ['/posts', '/posts/synthetic-game-mention']) {
                    await visit(path)
                    await auditPage.getByRole('heading').filter({ hasText: 'Played' }).waitFor()
                    await scan(path)
                }

                await auditContext.clearCookies()
                const signInError = await auditPage.goto(
                    new URL('/admin?pocket-id-error=1', app.url).href,
                )
                expect(signInError?.status()).toBe(403)
                await waitForNuxtReady(auditPage)
                await auditPage.waitForFunction(
                    (theme) => document.documentElement.classList.contains(theme),
                    colorScheme,
                )
                await auditPage.getByRole('link', { name: 'Retry Pocket ID sign-in' }).waitFor()
                await scan('pocket-id-error', 403)

                await auditContext.addCookies(sessionCookies)
                await visit('/admin')
                await auditPage.getByRole('heading', { name: 'Content Collections' }).waitFor()
                await scan('admin')

                await visit('/admin/posts')
                await auditPage.getByRole('link', { name: 'Played VALORANT' }).waitFor()
                await scan('admin-posts')

                await visit('/admin/posts/new')
                const slugInput = auditPage.getByLabel('Slug', { exact: true })
                await slugInput.waitFor()
                await scan('post-editor')

                allowExpectedValidation400 = true
                try {
                    await auditPage.getByRole('button', { name: 'Save draft', exact: true }).click()
                    await auditPage.locator('.ui-alert[role="alert"]').waitFor()
                } finally {
                    allowExpectedValidation400 = false
                }
                await scan('post-validation')

                await visit('/admin/skills')
                await auditPage.getByText('TypeScript', { exact: true }).waitFor()
                await scan('admin-skills')
                await auditPage.getByRole('button', { name: 'Edit', exact: true }).first().click()
                await auditPage.getByRole('dialog').getByLabel('Name', { exact: true }).waitFor()
                await scan('entry-edit-dialog')
                await auditPage.keyboard.press('Escape')
                await auditPage.getByRole('dialog').waitFor({ state: 'hidden' })

                await auditPage.getByRole('button', { name: 'Add', exact: true }).click()
                const addDialog = auditPage.getByRole('dialog')
                await addDialog.getByLabel('Name', { exact: true }).waitFor()
                expect(await addDialog.getByLabel('Order', { exact: true }).count()).toBe(0)
                await auditPage.keyboard.press('Escape')
                await addDialog.waitFor({ state: 'hidden' })

                const reorder = auditPage.getByRole('button', { name: 'Reorder', exact: true })
                await reorder.click()
                await scan('admin-skills-reorder')
                const skillOrder = () => auditPage.getByText(/^(TypeScript|Vue)$/).allTextContents()
                const [firstSkill, secondSkill] = await skillOrder()
                if (!firstSkill || !secondSkill) {
                    throw new Error('Missing skills to reorder')
                }
                const initialOrder = [firstSkill, secondSkill]
                const reverseOrder = [secondSkill, firstSkill]
                const firstHandle = auditPage.getByRole('button', {
                    name: `Reorder ${firstSkill}`,
                })
                const secondHandle = auditPage.getByRole('button', {
                    name: `Reorder ${secondSkill}`,
                })
                await firstHandle.focus()
                await auditPage.keyboard.press('Space')
                await auditPage.keyboard.press('ArrowDown')
                await expect.poll(skillOrder).toEqual(reverseOrder)
                await auditPage.keyboard.press('Escape')
                await expect.poll(skillOrder).toEqual(initialOrder)
                await expect
                    .poll(() => firstHandle.evaluate((el) => el === document.activeElement))
                    .toBe(true)

                await auditPage.getByRole('button', { name: `Move ${secondSkill} up` }).click()
                await expect.poll(skillOrder).toEqual(reverseOrder)
                await secondHandle.scrollIntoViewIfNeeded()
                await firstHandle.scrollIntoViewIfNeeded()
                const source = await secondHandle.boundingBox()
                const target = await auditPage
                    .getByRole('listitem')
                    .filter({ has: firstHandle })
                    .boundingBox()
                if (!source || !target) {
                    throw new Error('Missing drag handles')
                }
                await auditPage.mouse.move(
                    source.x + source.width / 2,
                    source.y + source.height / 2,
                )
                await auditPage.mouse.down()
                await auditPage.mouse.move(
                    source.x + source.width / 2,
                    target.y + target.height * 0.75,
                    {
                        steps: 12,
                    },
                )
                await expect.poll(() => secondHandle.getAttribute('aria-pressed')).toBe('true')
                await auditPage.mouse.up()
                await expect.poll(skillOrder).toEqual(initialOrder)

                await firstHandle.focus()
                await auditPage.keyboard.press('Space')
                await auditPage.keyboard.press('ArrowDown')
                await auditPage.keyboard.press('Space')
                await expect.poll(skillOrder).toEqual(reverseOrder)
                await auditPage.getByRole('button', { name: 'Save order', exact: true }).click()
                await reorder.waitFor()
                await auditPage.reload()
                await waitForNuxtReady(auditPage)
                await expect.poll(skillOrder).toEqual(reverseOrder)

                await visit('/admin/careers')
                await auditPage.getByText('No careers entries yet.', { exact: true }).waitFor()
                await auditPage.locator('[data-hairline] svg').waitFor()
                await scan('admin-careers-empty')

                await visit('/admin/assistant')
                await auditPage.getByText(/Ask Gemini 4 Hydrogen/).waitFor()
                await auditPage.locator('[data-hairline] svg').waitFor()
                await scan('admin-assistant')

                await visit('/admin/settings')
                await auditPage.getByText('Current session', { exact: true }).waitFor()
                await scan('admin-settings')

                await auditPage.setViewportSize({ width: 390, height: 844 })
                await visit('/')
                await auditPage.getByRole('button', { name: /VALORANT Act 1/ }).waitFor()
                await scan('home')

                await visit('/arts')
                await scanArtViewer()

                await visit('/posts/synthetic-game-mention')
                await auditPage.getByRole('heading').filter({ hasText: 'Played' }).waitFor()
                await scan('post-detail')

                await visit('/admin/posts/new')
                await slugInput.waitFor()
                await scan('post-editor')
                await auditPage
                    .getByRole('button', { name: /^(Open sidebar|サイドバーを開く)$/ })
                    .click()
                await auditPage.getByRole('dialog', { name: 'Admin navigation' }).waitFor()
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
                    const error = await readNuxtError(motionPage)
                    expect(
                        error,
                        `${reducedMotion} navigation failed at ${path}: ${error}`,
                    ).toBeNull()
                }

                await motionPage.goto(new URL('/arts', app.url).href)
                await settled('/arts')

                const artworkCard = motionPage.getByRole('button', {
                    name: 'View Accessibility artwork',
                    exact: true,
                })
                await artworkCard.focus()
                await artworkCard.press('Enter')

                const artworkDialog = motionPage.getByRole('dialog', {
                    name: 'Accessibility artwork',
                    exact: true,
                })
                await artworkDialog.waitFor()

                const enlarge = artworkDialog.getByRole('button', {
                    name: 'Enlarge image',
                    exact: true,
                })
                await enlarge.focus()
                await enlarge.press('Enter')

                const imageDialog = motionPage.getByRole('dialog', {
                    name: 'Image preview',
                    exact: true,
                })
                await imageDialog.waitFor()
                await motionPage.keyboard.press('Escape')
                await imageDialog.waitFor({ state: 'hidden' })
                await motionPage.waitForFunction(
                    () => document.activeElement?.getAttribute('aria-label') === 'Enlarge image',
                )

                await artworkDialog.getByRole('button', { name: 'Close', exact: true }).click()
                await artworkDialog.waitFor({ state: 'hidden' })
                await motionPage.waitForFunction(
                    () =>
                        document.activeElement?.getAttribute('aria-label') ===
                        'View Accessibility artwork',
                )

                await motionPage.goto(new URL('/arts?open=accessibility-artwork', app.url).href)
                await settled('/arts?open=accessibility-artwork')
                await artworkDialog.waitFor()
                await motionPage.evaluate(() => history.back())
                await artworkDialog.waitFor({ state: 'hidden' })

                await motionPage.evaluate(async () => {
                    const root: NuxtRootElement | null = document.querySelector('#__nuxt')
                    await root?.__vue_app__?.config?.globalProperties?.$nuxt?.$router?.push(
                        '/admin',
                    )
                })
                await settled('/admin')
                await motionPage.getByRole('link', { name: 'Back to site', exact: true }).click()
                await settled('/')
                await motionPage.getByRole('button', { name: /VALORANT Act 1/ }).waitFor()
                await motionPage.goBack()
                await settled('/admin')
                await motionPage.getByRole('link', { name: 'Back to site', exact: true }).waitFor()
                await motionPage.goForward()
                await settled('/')
                await motionPage.getByRole('button', { name: /VALORANT Act 1/ }).waitFor()

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

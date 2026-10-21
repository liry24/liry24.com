import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Run against Nuxt dev started with a synthetic BETTER_AUTH_SECRET and an isolated
// LIRY24_TEST_DB_PATH, passing those same variables to this local-only probe.
const origin = new URL(process.argv[2] || 'http://localhost:3000')
assert(
    ['localhost', '127.0.0.1'].includes(origin.hostname) && origin.protocol === 'http:',
    'Only local HTTP servers are allowed',
)
assert(!process.argv.includes('--worker'), 'Use the Vitest workerd suite for Worker integration')
assert(
    process.env.BETTER_AUTH_SECRET,
    'Supply the same synthetic auth secret as the local Nuxt server',
)
assert(
    process.env.LIRY24_TEST_DB_PATH,
    'Supply the isolated Void D1 SQLite file used by the local Nuxt server',
)
const databasePath = resolve(process.env.LIRY24_TEST_DB_PATH)
const apiOnly = process.argv.includes('--api-only')
if (process.argv.includes('--browser'))
    assert.equal(
        process.env.OPENAI_BASE_URL,
        'http://127.0.0.1:1/v1',
        'Use the same local AI failure endpoint for the server and probe',
    )
assert(existsSync(databasePath), 'Start Nuxt dev and let its startup migrations finish first')
const database = new DatabaseSync(databasePath)
database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
const id = `local-probe-${randomUUID()}`
const token = randomUUID()
const signedToken = encodeURIComponent(
    `${token}.${createHmac('sha256', process.env.BETTER_AUTH_SECRET).update(token).digest('base64')}`,
)
const cookie = `better-auth.session_token=${signedToken}; __Secure-better-auth.session_token=${signedToken}`
const request = async (
    path,
    { method = 'GET', body, rawBody, headers = {}, authenticated = true, status = 200 } = {},
) => {
    const response = await fetch(new URL(path, origin), {
        method,
        headers: {
            ...headers,
            ...(authenticated ? { cookie } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : rawBody ? { body: rawBody } : {}),
        signal: AbortSignal.timeout(90000),
        redirect: 'manual',
    }).catch((cause) => {
        throw new Error(`${method} ${path} failed`, { cause })
    })
    const text = await response.text()
    assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 300)}`)
    return response.headers.get('content-type')?.includes('application/json') && text
        ? JSON.parse(text)
        : text
}
let entry
let uploadedAsset
const publicEntries = []
const fullBodySentinel = `FULL_POST_BODY_${id.replaceAll('-', '_')}`
try {
    const now = Date.now()
    database
        .prepare(
            'INSERT INTO users (id,name,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(id, 'Local probe', `${id}@example.invalid`, 1, 'admin', now, now)
    database
        .prepare(
            'INSERT INTO sessions (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        )
        .run(id, token, id, now + 3600000, now, now)
    await request('/api/liti/models', { authenticated: false, status: 401 })
    if (!apiOnly)
        for (const path of ['/admin/data?model=works', '/admin/posts/new', '/admin/posts/unknown'])
            await request(path, { authenticated: false, status: 302 })
    const session = await request('/api/auth/get-session')
    assert.equal(session.user.id, id)
    const models = await request('/api/liti/models')
    for (const name of [
        'arts',
        'works',
        'careers',
        'ranks',
        'games',
        'gameStats',
        'skills',
        'socials',
        'posts',
    ])
        assert(models.models[name], `Required model: ${name}`)
    assert.equal(models.models.posts.fields.content.kind, 'markdown')
    assert.equal(
        models.models.games.fields.metrics.item.fields.positions.item.fields.image.kind,
        'image',
    )
    assert.equal(models.models.gameStats.fields.game.kind, 'relation')
    assert.equal(models.models.posts.publishing, true)
    assert.equal(models.models.posts.scheduling, true)
    for (const name of ['socials', 'ranks', 'games', 'gameStats']) {
        assert.equal(models.models[name].scheduling, false)
        assert.equal(models.models[name].revisions, false)
    }
    await request('/__liti-devtools/snapshot', { authenticated: false, status: 401 })
    const snapshot = await request('/__liti-devtools/snapshot')
    assert.equal(snapshot.database.schemaReady, true)
    assert.equal(snapshot.database.devDatabase, true)
    assert.equal(snapshot.database.connector, '@litijs/void/database')
    for (const name of Object.keys(models.models))
        assert(snapshot.models[name], `Inspectable authorized model: ${name}`)
    assert.equal(snapshot.assets.cleanup.minimumAge, 86400)
    if (!apiOnly) {
        // Browser fixtures must exist before the first cacheable posts/home SSR request.
        const publicPaths = process.argv.includes('--browser')
            ? ['/arts', '/works', '/admin/data?model=works']
            : ['/', '/arts', '/works', '/posts', '/admin/data?model=works']
        for (const path of publicPaths) await request(path)
    }
    entry = await request('/api/liti/entries/posts', {
        method: 'POST',
        status: 201,
        body: { data: { title: 'A', content: '# Draft A', tags: [], slug: id } },
    })
    const base = `/api/liti/entries/${entry.id}`
    console.log('PASS: application routes, model configuration and authenticated session')
    if (process.argv.includes('--browser')) {
        for (const [suffix, title] of [
            ['one', 'Public probe one'],
            ['two', 'Public probe two'],
            ['auto', 'Automatic probe'],
        ]) {
            const explicitSummary = suffix !== 'auto'
            const introduction = `${title} introduction.`
            const description = explicitSummary
                ? introduction
                : `${introduction} Another short introduction.`
            let post = await request('/api/liti/entries/posts', {
                method: 'POST',
                status: 201,
                body: {
                    data: {
                        title,
                        content: `${introduction}${explicitSummary ? '\n\n<!-- more -->' : '\n\nAnother short introduction.'}\n\n# ${title}\n\n${fullBodySentinel}\n\n${'The full article remains available. '.repeat(100)}`,
                        tags: [],
                        slug: `${id}-${suffix}`,
                    },
                },
            })
            publicEntries.push(post)
            post = await request(`/api/liti/entries/${post.id}/publish`, {
                method: 'POST',
                body: { expectedVersion: post.version },
            })
            const html = await request(`/posts/${post.data.slug}`, { authenticated: false })
            if (process.env.LIRY24_TEST_ARTIFACT_DIRECTORY)
                writeFileSync(
                    resolve(
                        process.env.LIRY24_TEST_ARTIFACT_DIRECTORY,
                        `detail-${suffix}-ssr.html`,
                    ),
                    html,
                )
            assert(html.includes(`<title>${title} | Liry24</title>`))
            assert(html.includes('property="og:type" content="article"'))
            assert(html.includes(`name="description" content="${description}"`))
            assert(html.includes(fullBodySentinel), 'Detail SSR must retain the full article')
            const detailResponse = await fetch(new URL(`/api/content/posts/${post.id}`, origin))
            assert.equal(detailResponse.status, 200)
            const detailPayload = await detailResponse.text()
            assert(
                detailPayload.includes(fullBodySentinel),
                'Detail HTTP must retain the full article',
            )
            if (process.env.LIRY24_TEST_ARTIFACT_DIRECTORY)
                writeFileSync(
                    resolve(
                        process.env.LIRY24_TEST_ARTIFACT_DIRECTORY,
                        `detail-${suffix}-http.json`,
                    ),
                    detailPayload,
                )
        }
        for (const path of ['/', '/posts']) {
            // SWR may have a startup/preflight snapshot; exercise a fresh cache key.
            const html = await request(`${path}?synthetic-probe=${encodeURIComponent(id)}`, {
                authenticated: false,
            })
            if (process.env.LIRY24_TEST_ARTIFACT_DIRECTORY)
                writeFileSync(
                    resolve(
                        process.env.LIRY24_TEST_ARTIFACT_DIRECTORY,
                        `summary-${path === '/' ? 'home' : 'posts'}-ssr.html`,
                    ),
                    html,
                )
            assert(html.includes('Public probe one introduction.'), `${path}: summary is rendered`)
            assert(
                html.includes('Automatic probe introduction.'),
                `${path}: automatic summary is rendered`,
            )
            assert(
                !html.includes(fullBodySentinel),
                `${path}: full body must not enter SSR or payload`,
            )
        }
        const { chromium } = await import('playwright-core')
        const browser = await chromium.launch({
            headless: true,
            executablePath: process.env.CHROMIUM_PATH,
        })
        try {
            const context = await browser.newContext()
            await context.route('**/*', (route) =>
                new URL(route.request().url()).origin === origin.origin
                    ? route.continue()
                    : route.abort(),
            )
            await context.addCookies([
                {
                    name: 'better-auth.session_token',
                    value: signedToken,
                    domain: origin.hostname,
                    path: '/',
                    httpOnly: true,
                    secure: false,
                    sameSite: 'Lax',
                },
                {
                    name: '__Secure-better-auth.session_token',
                    value: signedToken,
                    domain: origin.hostname,
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Lax',
                },
            ])
            const page = await context.newPage()
            for (const [path, title] of [
                ['/admin/posts/new', 'New Post'],
                ['/admin/data?model=posts', 'Data'],
                ['/admin/data?model=works', 'Data'],
            ]) {
                const html = await request(path)
                assert(html.includes(`<title>${title} | Liry24 Admin</title>`))
                assert.match(html, /<html\b[^>]*\blang="ja"(?:\s|>)/u)
            }
            const expectTitle = async (title) => {
                try {
                    await page.waitForFunction((value) => document.title === value, title, {
                        timeout: 15000,
                    })
                } catch (error) {
                    console.error(
                        'Head mismatch',
                        JSON.stringify(
                            await page.evaluate(() => {
                                const app = document.querySelector('#__nuxt').__vue_app__
                                const head = app.$nuxt.$head ?? app._context.provides.usehead
                                const value = (item) =>
                                    typeof item === 'function' ? item() : (item?.value ?? item)
                                return {
                                    path: location.pathname,
                                    title: document.title,
                                    entries: Array.from(head.entries.values())
                                        .map((entry) => ({
                                            priority:
                                                entry.options?.tagPriority ?? entry._o?.tagPriority,
                                            title: value(entry.input?.title),
                                            titleTemplate: value(entry.input?.titleTemplate),
                                        }))
                                        .filter(
                                            (entry) =>
                                                entry.title !== undefined ||
                                                entry.titleTemplate !== undefined,
                                        ),
                                }
                            }),
                        ),
                    )
                    throw error
                }
            }
            await page.goto(new URL('/admin/posts/new', origin).href)
            await page.waitForFunction(
                () => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false,
            )
            await expectTitle('New Post | Liry24 Admin')
            assert.equal(await page.locator('html').getAttribute('lang'), 'ja')
            await page.goto(new URL('/admin/data?model=posts', origin).href)
            await page.waitForFunction(
                () => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false,
            )
            await expectTitle('Data | Liry24 Admin')
            await page.getByRole('button', { name: /^New Post/ }).click()
            await expectTitle('New Post | Liry24 Admin')
            await page.goBack()
            await expectTitle('Data | Liry24 Admin')
            await page.goForward()
            await expectTitle('New Post | Liry24 Admin')
            for (const [path, title] of [
                ['/admin/data?model=works', 'Data | Liry24 Admin'],
                ['/admin/posts/new', 'New Post | Liry24 Admin'],
                ['/works', 'Works | Liry24'],
                ['/admin/posts/new', 'New Post | Liry24 Admin'],
                ['/works', 'Works | Liry24'],
                ['/admin/posts/new', 'New Post | Liry24 Admin'],
            ]) {
                await page.evaluate(
                    (path) =>
                        document.querySelector('#__nuxt').__vue_app__.$nuxt.$router.push(path),
                    path,
                )
                await expectTitle(title)
            }
            await page.waitForFunction(() => {
                const app = document.querySelector('#__nuxt').__vue_app__
                const head = app.$nuxt.$head ?? app._context.provides.usehead
                const value = (item) =>
                    typeof item === 'function' ? item() : (item?.value ?? item)
                const entries = Array.from(head.entries.values()).map((entry) => {
                    const input = value(entry.input)
                    return {
                        title: value(input?.title),
                        template: value(input?.titleTemplate),
                    }
                })
                return (
                    !app.$nuxt['~transitionPromise'] &&
                    !entries.some((entry) => entry.title === 'Data') &&
                    entries.filter((entry) => entry.title === 'New Post').length === 1 &&
                    entries.filter((entry) => entry.template === '%s | Liry24 Admin').length === 1
                )
            })
            console.log(
                'PASS: admin SSR/client titles, listing navigation, back/forward, repeated transitions from admin/public pages, completed transition promise and disposal of previous head entries',
            )
            await page.goto(new URL('/__liti-devtools/', origin).href)
            await page.waitForFunction(() =>
                document.querySelector('#snapshot')?.textContent?.includes('schemaReady'),
            )
            assert.equal(await page.getByRole('button').count(), 2)
            await page.getByRole('button', { name: 'Refresh', exact: true }).click()
            await page.waitForFunction(() =>
                document.querySelector('#status')?.textContent?.startsWith('Snapshot loaded'),
            )
            console.log(
                'PASS: authenticated read-only DevTools iframe, snapshot and manual refresh',
            )
            const errors = []
            page.on('pageerror', (error) => errors.push(error.message))
            page.on('console', (message) => {
                if (
                    message.type() === 'error' &&
                    !message.text().startsWith('Failed to load resource:')
                )
                    errors.push(message.text())
            })
            await page.goto(new URL(`/posts/${publicEntries[0].data.slug}`, origin).href)
            await page.waitForFunction(
                () => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false,
            )
            const projectedResponse = page
                .waitForResponse((response) => {
                    const url = new URL(response.url())
                    return url.origin === origin.origin && url.pathname === '/api/content/posts'
                })
                .catch((error) => error)
            await page.evaluate(() =>
                document.querySelector('#__nuxt').__vue_app__.$nuxt.$router.push('/posts'),
            )
            const projected = await projectedResponse
            if (projected instanceof Error) throw projected
            const projectedPayload = await projected.text()
            assert.equal(projected.status(), 200)
            assert(projectedPayload.includes('Public probe one introduction.'))
            assert(
                !projectedPayload.includes(fullBodySentinel),
                'List HTTP payload must exclude full bodies',
            )
            await page
                .locator('article')
                .filter({ has: page.locator(`a[href="/posts/${publicEntries[0].data.slug}"]`) })
                .last()
                .locator('.line-clamp-3')
                .waitFor()
            await page.locator(`a[href="/posts/${publicEntries[0].data.slug}"]`).first().click()
            await page.waitForURL(`**/posts/${publicEntries[0].data.slug}`)
            await page
                .getByRole('heading', { name: 'Public probe one', exact: true, level: 1 })
                .first()
                .waitFor()
            await page.waitForFunction(
                () => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false,
            )
            const navigate = (path) =>
                page.evaluate(
                    (path) =>
                        document.querySelector('#__nuxt').__vue_app__.$nuxt.$router.push(path),
                    path,
                )
            await navigate(`/posts/${publicEntries[1].data.slug}`)
            await page
                .getByRole('heading', { name: 'Public probe two', exact: true, level: 1 })
                .first()
                .waitFor()
            await page.waitForFunction(() => document.title === 'Public probe two | Liry24')
            assert.equal(
                await page.locator('meta[name="description"]').getAttribute('content'),
                'Public probe two introduction.',
            )
            await page.goBack()
            await page
                .getByRole('heading', { name: 'Public probe one', exact: true, level: 1 })
                .first()
                .waitFor()
            await navigate('/')
            await page
                .locator('a[href="/posts/' + publicEntries[0].data.slug + '"]')
                .last()
                .waitFor()
            console.log('PASS: application public routes, post metadata and summary rendering')
            await page.goto(new URL('/admin/data?model=posts', origin).href, {
                waitUntil: 'domcontentloaded',
            })
            await page.waitForFunction(
                () => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false,
            )
            const paginated = Array.from({ length: 21 }, (_, index) => ({
                ...entry,
                id: `${id}-page-${index + 1}`,
                data: {
                    ...entry.data,
                    title: `Pagination post ${index + 1}`,
                    slug: `${id}-page-${index + 1}`,
                },
            }))
            const listRoute = '**/api/liti/entries?**'
            await page.route(listRoute, async (route) => {
                const query = new URL(route.request().url()).searchParams
                if (query.get('model') !== 'posts') return route.continue()
                const limit = Number(query.get('limit'))
                const offset = Number(query.get('offset'))
                assert.equal(limit, 20)
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: paginated.slice(offset, offset + limit),
                        total: paginated.length,
                        limit,
                        offset,
                    }),
                })
            })
            await page
                .locator('#model-posts')
                .getByRole('button', { name: 'Reload latest', exact: true })
                .click()
            await page.getByText('Pagination post 1', { exact: true }).waitFor()
            await page.getByRole('button', { name: 'Page 2', exact: true }).click()
            await page.getByText('Pagination post 21', { exact: true }).waitFor()
            assert.equal(await page.getByText('Pagination post 1', { exact: true }).count(), 0)
            await page.getByRole('button', { name: 'Page 1', exact: true }).click()
            await page.getByText('Pagination post 1', { exact: true }).waitFor()
            await page.unroute(listRoute)
            const reloadList = page.waitForResponse(
                (response) => new URL(response.url()).pathname === '/api/liti/entries',
            )
            await page
                .locator('#model-posts')
                .getByRole('button', { name: 'Reload latest', exact: true })
                .click()
            const reloadedList = await (await reloadList).json()
            assert(
                reloadedList.items.some((item) => item.id === entry.id),
                JSON.stringify({ expectedId: entry.id, reloadedList }),
            )
            await page
                .getByText(entry.data.title, { exact: true })
                .waitFor()
                .catch(async (error) => {
                    console.error({
                        reloadedList,
                        body: await page.locator('body').innerText(),
                        errors,
                    })
                    throw error
                })
            assert.equal(await page.getByRole('navigation', { name: 'Post pages' }).count(), 0)
            console.log(
                'PASS: native management list pagination reaches posts beyond the first page',
            )
            for (const title of ['Browser draft one', 'Browser draft two']) {
                const row = page
                    .locator('tr')
                    .filter({ has: page.getByText(entry.data.title, { exact: true }) })
                    .last()
                await row.getByRole('button', { name: 'Edit', exact: true }).click()
                await page.waitForURL(`**/admin/posts/${entry.id}`)
                const editor = page.locator('#admin-post-form')
                await editor
                    .getByLabel(/^title/i)
                    .fill(title)
                    .catch(async (error) => {
                        console.error({
                            errors,
                            editors: await editor.count(),
                            editorText: await editor.allTextContents(),
                        })
                        throw error
                    })
                const tagInput = editor.locator('input[data-post-tags]')
                if (title === 'Browser draft one') {
                    let tagSaves = 0
                    const onTagRequest = (request) => {
                        if (request.method() === 'PATCH' && request.url().endsWith(base)) tagSaves++
                    }
                    page.on('request', onTagRequest)
                    try {
                        for (const tag of ['Vue', 'Vue', 'replace-me', '  spaced  ', 'comma,tag']) {
                            await tagInput.fill(tag)
                            await tagInput.press('Enter')
                        }
                        assert.deepEqual(
                            await editor.locator('[data-slot="itemText"]').allTextContents(),
                            ['Vue', 'Vue', 'replace-me', '  spaced  ', 'comma,tag'],
                        )
                        await editor
                            .getByRole('button', { name: 'replace-me', exact: true })
                            .click()
                        await tagInput.fill('replacement')
                        await tagInput.press('Enter')
                        await tagInput.evaluate((input) => {
                            const clipboardData = new DataTransfer()
                            clipboardData.setData('text/plain', 'paste-one\npaste-two')
                            input.dispatchEvent(
                                new ClipboardEvent('paste', {
                                    clipboardData,
                                    bubbles: true,
                                    cancelable: true,
                                }),
                            )
                        })
                        await tagInput.press('Enter')
                        await tagInput.fill('IME input')
                        await tagInput.evaluate((input) => {
                            input.dispatchEvent(
                                new CompositionEvent('compositionstart', { bubbles: true }),
                            )
                            input.dispatchEvent(
                                new KeyboardEvent('keydown', {
                                    key: 'Enter',
                                    isComposing: true,
                                    bubbles: true,
                                    cancelable: true,
                                }),
                            )
                            input.dispatchEvent(
                                new CompositionEvent('compositionend', { bubbles: true }),
                            )
                        })
                        assert.equal(await tagInput.inputValue(), 'IME input')
                        await tagInput.fill('')
                        assert.equal(tagSaves, 0, 'Tag Enter and IME must not save the post')
                        assert.deepEqual(
                            await editor.locator('[data-slot="itemText"]').allTextContents(),
                            [
                                'Vue',
                                'Vue',
                                '  spaced  ',
                                'comma,tag',
                                'replacement',
                                'paste-one',
                                'paste-two',
                            ],
                        )
                    } finally {
                        page.off('request', onTagRequest)
                    }
                } else {
                    assert.deepEqual(
                        await editor.locator('[data-slot="itemText"]').allTextContents(),
                        [
                            'Vue',
                            'Vue',
                            '  spaced  ',
                            'comma,tag',
                            'replacement',
                            'paste-one',
                            'paste-two',
                        ],
                    )
                }
                if (!uploadedAsset) {
                    const uploaded = page.waitForResponse(
                        (response) =>
                            response.url().endsWith('/api/liti/assets') &&
                            response.request().method() === 'POST',
                    )
                    await editor.locator('input[type="file"]').setInputFiles({
                        name: 'local-probe.png',
                        mimeType: 'image/png',
                        buffer: Buffer.concat([
                            Buffer.from(
                                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
                                'base64',
                            ),
                            Buffer.alloc(11 * 1024 * 1024),
                        ]),
                    })
                    const response = await uploaded
                    assert.equal(response.status(), 201)
                    uploadedAsset = (await response.json()).id
                    assert(uploadedAsset)
                    await editor
                        .locator(`img[src$="/api/liti/assets/${uploadedAsset}/content"]`)
                        .waitFor()
                    await editor.getByText('local-probe.png', { exact: true }).waitFor()
                } else {
                    await editor.getByRole('button', { name: 'Clear reference' }).click()
                }
                const saved = page.waitForResponse(
                    (response) =>
                        response.url().endsWith(base) && response.request().method() === 'PATCH',
                )
                await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
                assert.equal((await saved).status(), 200)
                await page.waitForURL('**/admin/data?model=posts')
                await page.getByText(title, { exact: true }).waitFor()
                entry = await request(base)
                assert.equal(entry.data.title, title)
                assert.deepEqual(entry.data.tags, [
                    'Vue',
                    'Vue',
                    '  spaced  ',
                    'comma,tag',
                    'replacement',
                    'paste-one',
                    'paste-two',
                ])
                assert.equal(entry.publishedRevisionId, null)
                assert.deepEqual(
                    entry.data.image ?? null,
                    title === 'Browser draft one' ? { id: uploadedAsset } : null,
                )
            }
            assert.equal((await request(`/api/liti/assets/${uploadedAsset}`)).state, 'ready')
            await request(`/api/liti/assets/${uploadedAsset}/content`)
            assert.deepEqual(errors, [])
            console.log(
                'PASS: Chrome dedicated editor, tag chips add/remove/replace, duplicate/whitespace/comma/paste preservation, Enter/IME do not save, tags save/reload, two saves, uploaded image preview, reference clear preserves Blob, Save Draft does not publish',
            )
            await page.getByRole('button', { name: /^New Post/ }).click()
            await page.waitForURL('**/admin/posts/new')
            assert.equal(await page.getByRole('dialog').count(), 0)
            const titleInput = page.getByLabel('Title', { exact: true })
            const contentInput = page.getByLabel('Content', { exact: true })
            const manualSlug = page.getByRole('checkbox', { name: 'Enter slug manually' })
            assert.equal(await manualSlug.isChecked(), false)
            assert.equal(
                await page.getByRole('checkbox', { name: 'Enter excerpt manually' }).count(),
                0,
            )
            assert.equal(await page.getByLabel('Slug', { exact: true }).count(), 0)
            assert.equal(await page.getByLabel('Excerpt', { exact: true }).count(), 0)
            await titleInput.fill('Browser create draft')
            const newTagInput = page.locator('input[data-post-tags]')
            await newTagInput.fill('draft-tag')
            await newTagInput.press('Enter')
            const original =
                '# Safe preview\n\n**Markdown works**\n\n<script>window.__previewUnsafe = true</script>\n<img src=x alt="Security test image" onerror="window.__previewUnsafe = true">\n\n[Unsafe link](javascript:alert(1))\n\n::admin-form-entry-modal\n::'
            await contentInput.fill(original)
            const preview = page.getByRole('region', { name: 'Markdown preview' })
            await preview.getByRole('heading', { name: 'Safe preview' }).waitFor()
            assert.equal(await preview.locator('strong').textContent(), 'Markdown works')
            assert.equal(
                await preview.locator('script, img[onerror], a[href^="javascript:"]').count(),
                0,
            )
            assert.equal(await page.evaluate(() => window.__previewUnsafe), undefined)
            assert.equal(await page.getByRole('dialog').count(), 0)
            await page.getByRole('link', { name: 'Back to Posts', exact: true }).click()
            await page.waitForURL('**/admin/data?model=posts')
            await page.goBack()
            await page.waitForURL('**/admin/posts/new')
            await page.getByText('Unsaved input restored', { exact: true }).waitFor()
            assert.equal(await titleInput.inputValue(), 'Browser create draft')
            assert.equal(await contentInput.inputValue(), original)
            assert.deepEqual(
                await page.locator('#admin-post-form [data-slot="itemText"]').allTextContents(),
                ['draft-tag'],
            )
            await page.goForward()
            await page.waitForURL('**/admin/data?model=posts')
            await page.goBack()
            await page.waitForURL('**/admin/posts/new')
            await page.waitForFunction(() => {
                const app = document.querySelector('#__nuxt')?.__vue_app__?.$nuxt
                const path = location.pathname + location.search + location.hash
                return (
                    app &&
                    !app._processingMiddleware &&
                    app.$router.currentRoute.value.fullPath === path &&
                    app._route.fullPath === path &&
                    !app['~transitionPromise'] &&
                    document.querySelectorAll('#admin-post-form').length === 1
                )
            })
            assert.equal(await contentInput.inputValue(), original)

            let automaticPublications = 0
            let proofreadingCalls = 0
            let draftCreates = 0
            let publications = 0
            page.on('request', (request) => {
                if (request.method() !== 'POST') return
                if (request.url().endsWith('/api/liti/entries/posts')) draftCreates++
                if (
                    /\/api\/liti\/entries\/[^/]+\/publish$/.test(request.url()) &&
                    request.postDataJSON().draft?.data?.publication?.slug === 'auto'
                )
                    automaticPublications++
            })
            page.on('response', (response) => {
                if (
                    response.status() === 200 &&
                    /\/api\/liti\/entries\/[^/]+\/publish$/.test(response.url())
                )
                    publications++
            })
            let corrected = original.replace('Markdown works', 'Markdown corrected')
            let invalidProofreading = false
            await page.route('**/api/liti/actions/proofread', async (route) => {
                proofreadingCalls++
                const body = route.request().postDataJSON()
                assert.deepEqual(Object.keys(body), ['input'])
                assert.deepEqual(Object.keys(body.input), ['content'])
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: { content: invalidProofreading ? '' : corrected },
                    }),
                })
            })
            await page.getByRole('button', { name: 'Proofread Content', exact: true }).click()
            await page.getByRole('region', { name: 'Proofreading suggestion' }).waitFor()
            assert.equal(draftCreates, 0, 'Proofreading a new post must not save a draft')
            assert.equal(await contentInput.inputValue(), original)
            await page.getByRole('button', { name: 'Discard Suggestion' }).click()
            const created = page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' &&
                    response.url().endsWith('/api/liti/entries/posts'),
            )
            await page.evaluate(() => {
                const form = document.querySelector('#admin-post-form')
                form.requestSubmit()
            })
            const response = await created
            assert.equal(response.status(), 201)
            const newEntry = await response.json()
            try {
                try {
                    await page.waitForURL('**/admin/data?model=posts')
                } catch (error) {
                    console.error({
                        newDraftNavigation: page.url(),
                        formText: await page.locator('main').innerText(),
                        errors,
                    })
                    throw error
                }
                assert.equal(automaticPublications, 0)
                assert.equal(proofreadingCalls, 1)
                assert.equal(draftCreates, 1)
                assert.equal(newEntry.data.excerpt, undefined)
                assert.deepEqual(newEntry.data.publication, { slug: 'auto' })
                assert.equal(newEntry.publishedRevisionId, null)
                await page
                    .locator('tr')
                    .filter({ has: page.getByText(newEntry.data.title, { exact: true }) })
                    .last()
                    .getByRole('button', { name: 'Edit', exact: true })
                    .click()
                await page.waitForURL(`**/admin/posts/${newEntry.id}`)
                await contentInput.waitFor()
                await page.getByRole('button', { name: 'Proofread Content', exact: true }).click()
                await page.getByRole('region', { name: 'Proofreading suggestion' }).waitFor()
                assert.equal(await contentInput.inputValue(), original)
                await contentInput.fill(original + '\n\nNew sentence.')
                assert.equal(
                    await page.getByRole('button', { name: 'Apply Suggestion' }).isDisabled(),
                    true,
                )
                await page.getByRole('button', { name: 'Proofread Content', exact: true }).click()
                await page.getByRole('button', { name: 'Apply Suggestion' }).click()
                assert.equal(await contentInput.inputValue(), corrected)
                invalidProofreading = true
                await page.getByRole('button', { name: 'Proofread Content', exact: true }).click()
                await page.getByText('Invalid proofreading suggestion', { exact: true }).waitFor()
                assert.equal(
                    await page.getByRole('button', { name: 'Apply Suggestion' }).isDisabled(),
                    true,
                )
                assert.equal(await contentInput.inputValue(), corrected)
                await page.getByRole('button', { name: 'Discard Suggestion' }).click()
                assert.equal(await contentInput.inputValue(), corrected)
                assert.equal(
                    (await request(`/api/liti/entries/${newEntry.id}`)).publishedRevisionId,
                    null,
                )
                await manualSlug.check()
                await page.getByLabel('Slug', { exact: true }).fill('')
                await page.getByRole('button', { name: 'Publish', exact: true }).click()
                await page
                    .getByText('Enter a valid slug before publishing.', { exact: true })
                    .waitFor()
                assert.equal(automaticPublications, 0)
                await page.getByLabel('Slug', { exact: true }).fill(`${id}-browser-new`)
                await page.getByRole('link', { name: 'Back to Posts', exact: true }).click()
                await page.waitForURL('**/admin/data?model=posts')
                await page.goBack()
                await page.waitForURL(`**/admin/posts/${newEntry.id}`)
                await titleInput.waitFor()
                assert.equal(await manualSlug.isChecked(), true)
                assert.equal(
                    await page.getByLabel('Slug', { exact: true }).inputValue(),
                    `${id}-browser-new`,
                )
                assert.equal(await contentInput.inputValue(), corrected)
                await page.waitForFunction(() => {
                    const app = document.querySelector('#__nuxt')?.__vue_app__?.$nuxt
                    return (
                        app &&
                        !app._processingMiddleware &&
                        app._route.fullPath ===
                            location.pathname + location.search + location.hash &&
                        !app['~transitionPromise'] &&
                        document.querySelectorAll('#admin-post-form').length === 1
                    )
                })
                await page.getByRole('button', { name: 'Publish', exact: true }).click()
                await page.waitForURL('**/admin/data?model=posts')
                const stored = await request(`/api/liti/entries/${newEntry.id}`)
                assert.equal(stored.data.slug, `${id}-browser-new`)
                assert.equal(stored.data.title, 'Browser create draft')
                assert.deepEqual(stored.data.tags, ['draft-tag'])
                assert.equal(stored.data.content, corrected)
                assert.equal(stored.data.excerpt, undefined)
                assert.equal(stored.currentRevisionId, stored.publishedRevisionId)
                assert.equal(automaticPublications, 0)
                assert.equal(proofreadingCalls, 4)
                assert.equal(publications, 1)
                await page
                    .locator('tr')
                    .filter({ has: page.getByText(stored.data.title, { exact: true }) })
                    .last()
                    .getByRole('button', { name: 'Edit', exact: true })
                    .click()
                await page.waitForURL(`**/admin/posts/${stored.id}`)
                await page.getByRole('link', { name: 'Back to Posts', exact: true }).click()
                await page.waitForURL('**/admin/data?model=posts')
            } finally {
                const latest = await request(`/api/liti/entries/${newEntry.id}`)
                await request(`/api/liti/entries/${newEntry.id}`, {
                    method: 'DELETE',
                    status: 204,
                    headers: { 'if-match': `"${latest.version}"` },
                })
            }

            await page.getByRole('button', { name: /^New Post/ }).click()
            await page.waitForURL('**/admin/posts/new')
            assert.equal(await manualSlug.isChecked(), false)
            assert.equal(await titleInput.inputValue(), '')
            assert.equal(await contentInput.inputValue(), '')
            assert.equal(await page.getByLabel('Slug', { exact: true }).count(), 0)
            for (let index = 0; index < 2; index++) {
                if (index) {
                    await page.getByRole('button', { name: /^New Post/ }).click()
                    await page.waitForURL('**/admin/posts/new')
                }
                await titleInput.fill('これはexample title')
                await contentInput.fill('Original fallback body.')
                const publishing = page.waitForResponse((response) =>
                    /\/api\/liti\/entries\/[^/]+\/publish$/.test(response.url()),
                )
                await page.getByRole('button', { name: 'Publish', exact: true }).click()
                const response = await publishing
                assert.equal(response.status(), 200, await response.text())
                const published = await response.json()
                publicEntries.push(published)
                await page.waitForURL('**/admin/data?model=posts')
                assert.match(
                    published.data.slug,
                    index ? /^example-title-[a-z0-9]{6}$/ : /^example-title$/,
                )
                assert.equal(published.data.title, 'これはexample title')
                assert.equal(published.data.content, 'Original fallback body.')
                assert.equal(published.currentRevisionId, published.publishedRevisionId)
            }
            assert.equal(automaticPublications, 2)
            assert.deepEqual(errors, [])
            console.log(
                'PASS: creation page, safe Comark preview, native back/forward draft recovery, AI-free draft, manual publication and automatic publication with unavailable AI, duplicate slug suffixes, validation preserves input, empty slug validation, native proofreading review/apply/discard and invalid/stale guards, consecutive new posts reset manual slug mode and input',
            )
        } finally {
            await browser.close()
        }
    }
} finally {
    try {
        for (const record of [entry, ...publicEntries].filter(Boolean)) {
            const latest = await request(`/api/liti/entries/${record.id}`)
            await request(`/api/liti/entries/${record.id}`, {
                method: 'DELETE',
                status: 204,
                headers: { 'if-match': `"${latest.version}"` },
            })
        }
        for (const asset of [uploadedAsset].filter(Boolean))
            await request(`/api/liti/assets/${asset}`, {
                method: 'DELETE',
                status: 204,
            })
    } finally {
        try {
            database.prepare('DELETE FROM sessions WHERE id = ?').run(id)
            database.prepare('DELETE FROM users WHERE id = ?').run(id)
        } finally {
            database.close()
        }
    }
}

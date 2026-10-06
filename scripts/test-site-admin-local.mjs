import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'

// Local-only integration probe. Run with node --env-file=.env scripts/test-site-admin-local.mjs.
const origin = new URL(process.argv[2] || 'http://localhost:3000')
assert(
    ['localhost', '127.0.0.1'].includes(origin.hostname) && origin.protocol === 'http:',
    'Only local HTTP servers are allowed',
)
assert(process.env.BETTER_AUTH_SECRET, 'Load the same local environment as Nuxt')
const id = `local-probe-${randomUUID()}`
const token = randomUUID()
const signedToken = encodeURIComponent(
    `${token}.${createHmac('sha256', process.env.BETTER_AUTH_SECRET).update(token).digest('base64')}`,
)
const cookie = `better-auth.session_token=${signedToken}; __Secure-better-auth.session_token=${signedToken}`
const persist = '.data/unified'
const sql = (command) =>
    execFileSync(
        process.execPath,
        [
            'node_modules/cf/bin/cf',
            'd1',
            'raw',
            '227d818f-cd40-4fca-9710-b57273be94ca',
            '--local',
            '--persist-to',
            persist,
            '--sql',
            command,
        ],
        { stdio: 'pipe' },
    )
const request = async (
    path,
    { method = 'GET', body, headers = {}, authenticated = true, status = 200 } = {},
) => {
    const response = await fetch(new URL(path, origin), {
        method,
        headers: {
            ...headers,
            ...(authenticated ? { cookie } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 300)}`)
    return response.headers.get('content-type')?.includes('application/json') && text
        ? JSON.parse(text)
        : text
}
let entry
let uploadedAsset
try {
    const now = Date.now()
    sql(
        `INSERT INTO users (id,name,email,email_verified,role,created_at,updated_at) VALUES ('${id}','Local probe','${id}@example.invalid',1,'admin',${now},${now}); INSERT INTO sessions (id,token,user_id,expires_at,created_at,updated_at) VALUES ('${id}','${token}','${id}',${now + 3600000},${now},${now});`,
    )
    await request('/api/site-admin/models', { authenticated: false, status: 401 })
    await request('/admin/works', { authenticated: false, status: 404 })
    const session = await request('/api/auth/get-session')
    assert.equal(session.user.id, id)
    const models = await request('/api/site-admin/models')
    assert.equal(Object.keys(models.models).length, 7)
    if (!process.argv.includes('--worker')) {
        await request('/__site-admin-devtools/snapshot', { authenticated: false, status: 401 })
        const snapshot = await request('/__site-admin-devtools/snapshot')
        assert.equal(snapshot.database.schemaReady, true)
        assert.equal(snapshot.database.devDatabase, false)
        assert.equal(snapshot.database.connector, 'application')
        assert.equal(Object.keys(snapshot.models).length, 7)
        assert.equal(snapshot.assets.cleanup.minimumAge, 86400)
    }
    for (const path of ['/', '/arts', '/works', '/posts', '/admin/works']) await request(path)
    entry = await request('/api/site-admin/entries/posts', {
        method: 'POST',
        status: 201,
        body: { slug: id, data: { title: 'A', content: '# Draft A', tags: [] } },
    })
    const base = `/api/site-admin/entries/${entry.id}`
    const mutate = async (action, extra = {}, method = 'POST') =>
        (entry = await request(base + action, {
            method,
            body: { expectedVersion: entry.version, ...extra },
        }))
    const revisionA = entry.currentRevisionId
    await request(`/api/content/posts/${id}`, { authenticated: false, status: 404 })
    if (process.argv.includes('--worker')) {
        await mutate('/schedule', { at: new Date(Date.now() + 1500).toISOString() })
        await new Promise((resolve) => setTimeout(resolve, 1600))
        await request('/cdn-cgi/local/scheduled', { authenticated: false })
        for (let attempt = 0; attempt < 30; attempt++) {
            entry = await request(base)
            if (entry.publishedRevisionId === entry.currentRevisionId) break
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        assert.equal(
            entry.publishedRevisionId,
            entry.currentRevisionId,
            'Cloudflare scheduled hook did not publish due revision',
        )
        await mutate('/unpublish')
    }
    await mutate('/publish')
    await request(`/posts/${id}`)
    const oldVersion = entry.version
    await mutate('', { data: { title: 'B', content: '# Draft B', tags: [] } }, 'PATCH')
    await request(base, {
        method: 'PATCH',
        status: 409,
        body: { expectedVersion: oldVersion, data: { title: 'stale', content: '', tags: [] } },
    })
    await mutate('/schedule', { at: new Date(Date.now() + 3600000).toISOString() })
    const revisionB = entry.currentRevisionId
    await mutate('', { data: { title: 'C', content: '# Draft C', tags: [] } }, 'PATCH')
    assert.equal(entry.publishedRevisionId, revisionA)
    assert.equal(entry.scheduledRevisionId, revisionB)
    assert.notEqual(entry.currentRevisionId, revisionB)
    await mutate(`/revisions/${revisionA}/restore`)
    assert.equal(entry.data.title, 'A')
    assert.notEqual(entry.currentRevisionId, revisionA)
    await mutate('/cancel-schedule')
    await mutate('/unpublish')
    await request(`/api/content/posts/${id}`, { authenticated: false, status: 404 })
    console.log(
        'PASS: public pages, anonymous admin 404/API 401, Better Auth admin, CRUD, conflict, published/scheduled/current revisions, restore, unpublish',
    )
    if (process.argv.includes('--browser')) {
        const { chromium } = await import('playwright-core')
        const browser = await chromium.launch({ channel: 'chrome', headless: true })
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
            if (!process.argv.includes('--worker')) {
                await page.goto(new URL('/__site-admin-devtools/', origin).href)
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
            }
            const errors = []
            page.on('pageerror', (error) => errors.push(error.message))
            page.on('console', (message) => {
                if (
                    message.type() === 'error' &&
                    !message.text().startsWith('Failed to load resource:')
                )
                    errors.push(message.text())
            })
            await page.goto(new URL('/admin/posts', origin).href, { waitUntil: 'domcontentloaded' })
            await page.waitForFunction(
                () => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false,
            )
            for (const title of ['Browser draft one', 'Browser draft two']) {
                const row = page.locator('li').filter({ hasText: entry.slug }).last()
                await row.getByRole('button', { name: 'Edit', exact: true }).click()
                const dialog = page.getByRole('dialog')
                await dialog
                    .getByLabel(/^title/i)
                    .fill(title)
                    .catch(async (error) => {
                        console.error({
                            errors,
                            dialogs: await dialog.count(),
                            dialogText: await dialog.allTextContents(),
                        })
                        throw error
                    })
                if (!uploadedAsset) {
                    const uploaded = page.waitForResponse(
                        (response) =>
                            response.url().endsWith('/api/site-admin/assets') &&
                            response.request().method() === 'POST',
                    )
                    await dialog.locator('input[type="file"]').setInputFiles({
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
                    await dialog
                        .locator(`img[src="/api/site-admin/assets/${uploadedAsset}/content"]`)
                        .waitFor()
                    await dialog.getByText('local-probe.png', { exact: true }).waitFor()
                } else {
                    await dialog.getByRole('button', { name: 'Clear reference' }).click()
                }
                const saved = page.waitForResponse(
                    (response) =>
                        response.url().endsWith(base) && response.request().method() === 'PATCH',
                )
                await dialog.getByRole('button', { name: 'Save Draft', exact: true }).click()
                assert.equal((await saved).status(), 200)
                await dialog.waitFor({ state: 'hidden' })
                entry = await request(base)
                assert.equal(entry.data.title, title)
                assert.equal(entry.publishedRevisionId, null)
                assert.equal(
                    entry.data.image ?? null,
                    title === 'Browser draft one' ? uploadedAsset : null,
                )
            }
            assert.equal((await request(`/api/site-admin/assets/${uploadedAsset}`)).state, 'ready')
            await request(`/api/site-admin/assets/${uploadedAsset}/content`)
            assert.deepEqual(errors, [])
            console.log(
                'PASS: Chrome overlay, Form two saves, uploaded image preview, reference clear preserves Blob, Save Draft does not publish',
            )
        } finally {
            await browser.close()
        }
    }
} finally {
    try {
        if (entry?.id) {
            const latest = await request(`/api/site-admin/entries/${entry.id}`)
            await request(`/api/site-admin/entries/${entry.id}`, {
                method: 'DELETE',
                status: 204,
                headers: { 'if-match': `"${latest.version}"` },
            })
        }
        if (uploadedAsset)
            await request(`/api/site-admin/assets/${uploadedAsset}`, {
                method: 'DELETE',
                status: 204,
            })
    } finally {
        sql(`DELETE FROM sessions WHERE id='${id}'; DELETE FROM users WHERE id='${id}';`)
    }
}

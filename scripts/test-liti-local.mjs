import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, relative, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const temporary = realpathSync.native(tmpdir())
const consumer = mkdtempSync(resolve(temporary, 'liry24-native-dev-'))
const excluded = new Set([
    '.git',
    'node_modules',
    '.nuxt',
    '.output',
    '.vitehub',
    '.wrangler',
    '.data',
    '.tmp',
    '.codex',
    '.agents',
])
cpSync(root, consumer, {
    recursive: true,
    filter: (path) =>
        !relative(root, path)
            .split(/[\\/]/)
            .some(
                (part) =>
                    excluded.has(part) || part.startsWith('.env') || part.startsWith('.dev.vars'),
            ),
})
const env = {
    ...process.env,
    APP_ENV: 'test',
    LIRY24_TEST_LOCAL: 'true',
    LIRY24_TEST_CRON: 'false',
    LIRY24_WORKER_NAME: 'liry24-vitehub-synthetic',
    LIRY24_DATABASE_ID: '00000000-0000-4000-8000-000000000100',
    LIRY24_DATABASE_NAME: 'liry24-vitehub-synthetic',
    LIRY24_MEDIA_BUCKET: 'liry24-vitehub-synthetic-media',
    LIRY24_CONTENT_BUCKET: 'liry24-vitehub-synthetic-content',
    NUXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: '--max-old-space-size=6144',
    BETTER_AUTH_SECRET: 'synthetic-native-dev-auth-secret-0123456789',
    NUXT_APP_SECRET: 'synthetic-native-dev-app-secret-0123456789',
}
for (const key of Object.keys(env))
    if (/^(?:OPENAI_|ANTHROPIC_|CLOUDFLARE_|CF_|IGDB_|GITHUB_|PREVIEW_)/.test(key)) delete env[key]
if (process.platform === 'win32') env.TEMP = env.TMP = temporary
const run = (command, args) => {
    const result = spawnSync(command, args, {
        cwd: consumer,
        env,
        stdio: 'inherit',
        windowsHide: true,
    })
    if (result.error) throw result.error
    assert.equal(result.status, 0, command + ' ' + args.join(' '))
}
let child,
    database,
    browser,
    success = false,
    logs = ''
try {
    console.log('Independent synthetic Nuxt dev consumer:', consumer)
    run('bun', ['install', '--frozen-lockfile', '--ignore-scripts'])
    const probe = createServer()
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const { port } = probe.address()
    await new Promise((done, reject) => probe.close((error) => (error ? reject(error) : done())))
    const origin = 'http://127.0.0.1:' + port
    env.NUXT_PUBLIC_SITE_URL = origin
    const sqlite = resolve(consumer, '.vitehub/data/database/sqlite.db')
    assert.ok(!existsSync(sqlite))
    run(process.execPath, ['node_modules/liti/dist/cli/index.js', 'generate'])
    assert.ok(!existsSync(sqlite), 'Generation must not create or migrate the local database')
    run(process.execPath, ['node_modules/vite-hub/dist/bin.js', 'db', 'migrate'])
    assert.ok(existsSync(sqlite), 'Use the local SQLite target owned by the native Nuxt dev CLI')
    database = new DatabaseSync(sqlite)
    const now = Date.now(),
        id = 'dev-' + randomUUID(),
        token = randomUUID()
    database
        .prepare(
            'INSERT INTO user (id,name,email,email_verified,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(id, 'Dev editor', id + '@example.invalid', 1, 'admin', now, now)
    database
        .prepare(
            'INSERT INTO session (id,token,user_id,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        )
        .run(id, token, id, now + 3600000, now, now)
    database.close()
    database = undefined
    const signed = encodeURIComponent(
        token + '.' + createHmac('sha256', env.BETTER_AUTH_SECRET).update(token).digest('base64'),
    )
    const cookie = 'better-auth.session_token=' + signed
    child = spawn(
        process.execPath,
        [
            'node_modules/nuxt/bin/nuxt.mjs',
            'dev',
            '--no-fork',
            '--no-tui',
            '--no-takeover',
            '--strictPort',
            '--host',
            '127.0.0.1',
            '--port',
            String(port),
        ],
        {
            cwd: consumer,
            env,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    )
    child.stdout.on('data', (value) => {
        logs = (logs + value).slice(-24000)
    })
    child.stderr.on('data', (value) => {
        logs = (logs + value).slice(-24000)
    })
    let ready = false
    for (let attempt = 0; attempt < 180; attempt++) {
        if (child.exitCode !== null) throw Error('Nuxt dev exited:\n' + logs)
        try {
            const response = await fetch(origin, { signal: AbortSignal.timeout(2000) })
            const html = await response.text()
            if (response.ok && html.includes('Liry24')) {
                ready = true
                break
            }
            if (response.status !== 503 || !html.includes('__NUXT_LOADING__'))
                throw Error('SSR readiness failed: ' + response.status + ' ' + html.slice(0, 1800))
        } catch (error) {
            if (!(error instanceof TypeError) && !(error instanceof DOMException)) throw error
        }
        await new Promise((done) => setTimeout(done, 500))
    }
    assert.ok(ready, 'Nuxt never completed HTML SSR:\n' + logs)
    async function request(path, options = {}, status = 200) {
        const read = (options.method ?? 'GET') === 'GET'
        let lastError
        for (let attempt = 0; attempt < (read ? 9 : 1); attempt++) {
            try {
                const response = await fetch(origin + path, {
                    ...options,
                    headers: { cookie, origin, ...options.headers },
                    signal: AbortSignal.timeout(read ? 10000 : 90000),
                    redirect: 'manual',
                })
                const text = await response.text()
                if (read && response.status === 503 && text.includes('__NUXT_LOADING__')) {
                    await new Promise((done) => setTimeout(done, 500))
                    continue
                }
                assert.equal(response.status, status, path + ': ' + text.slice(0, 1500))
                return response.headers.get('content-type')?.includes('application/json') && text
                    ? JSON.parse(text)
                    : text
            } catch (error) {
                if (!read || (!(error instanceof TypeError) && !(error instanceof DOMException)))
                    throw new Error((options.method ?? 'GET') + ' ' + path + ' failed', {
                        cause: error,
                    })
                lastError = error
                console.log('Waiting for Nuxt dev read after reload:', path)
                await new Promise((done) => setTimeout(done, 500))
            }
        }
        throw new Error('Nuxt dev read did not settle: ' + path, { cause: lastError })
    }
    const manage = (body) =>
        request('/api/_liti/manage', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
    assert.equal((await request('/api/auth/get-session')).user.id, id)
    assert.equal((await manage({ action: 'models' })).length, 9)
    await request(
        '/api/_liti/manage',
        {
            method: 'POST',
            headers: { cookie: '', 'content-type': 'application/json' },
            body: '{"action":"models"}',
        },
        401,
    )
    await request(
        '/api/_liti/manage',
        {
            method: 'POST',
            headers: { origin: 'https://hostile.invalid', 'content-type': 'application/json' },
            body: '{"action":"models"}',
        },
        403,
    )
    console.log('PASS native Nuxt dev HTML readiness, durable authentication and management denial')
    const bytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
    )
    const uploadBody = new FormData()
    uploadBody.append('files', new File([bytes], 'native-dev.png', { type: 'image/png' }))
    const [cover] = await request('/api/admin/images?model=posts', {
        method: 'POST',
        body: uploadBody,
    })
    assert.equal(typeof cover.pathname, 'string')
    const image = await fetch(origin + '/media/' + cover.pathname)
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('content-type'), 'image/png')
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes)
    console.log('PASS native R2 image upload and public bytes without HTTP storage credentials')
    const post = id + '-post',
        title = 'Native dev article',
        publishedBody = 'Public development article.'
    let receipt = await manage({
        action: 'save',
        model: 'posts',
        id: post,
        locale: 'ja',
        ifDigest: null,
        data: { title, tags: [], cover },
        body: publishedBody,
    })
    assert.equal(await request('/api/_liti?model=posts&mode=one&id=' + post + '&locale=ja'), null)
    await manage({ action: 'publish', model: 'posts', id: post, digests: { ja: receipt.digest } })
    const published = await request('/api/_liti?model=posts&mode=one&id=' + post + '&locale=ja')
    const privateBody = 'PRIVATE_DEV_DRAFT_' + randomUUID()
    receipt = await manage({
        action: 'save',
        model: 'posts',
        id: post,
        locale: 'ja',
        ifDigest: receipt.digest,
        data: { title, tags: [], cover },
        body: privateBody,
    })
    const path = '/posts/' + encodeURIComponent(published.data.slug)
    const html = await request(path)
    assert.ok(html.includes(publishedBody))
    assert.ok(!html.includes(privateBody))
    assert.equal(
        (await request('/api/_liti?model=posts&mode=one&id=' + post + '&locale=ja')).body,
        publishedBody,
    )
    console.log('PASS native Workspace publication, later draft isolation and article SSR')
    const require = createRequire(resolve(consumer, 'package.json'))
    const { chromium } = require('playwright-core')
    browser = await chromium.launch({
        headless: true,
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    })
    const context = await browser.newContext()
    await context.addCookies([
        {
            name: 'better-auth.session_token',
            value: signed,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
        },
    ])
    await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    )
    const page = await context.newPage(),
        errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(origin + '/admin/posts/' + post, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
        () =>
            document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt
                ?.isHydrating === false,
    )
    assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), title)
    const body = page.getByLabel('Content', { exact: true })
    assert.equal(await body.inputValue(), privateBody)
    const edited = privateBody + ' edited in the native dev browser'
    await body.fill(edited)
    const saved = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/api/_liti/manage' &&
            response.request().method() === 'POST' &&
            response.request().postDataJSON()?.action === 'save',
    )
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
    assert.equal((await saved).status(), 200)
    assert.equal(
        (await manage({ action: 'read', model: 'posts', id: post, locale: 'ja' })).body,
        edited,
    )
    assert.ok(!(await request(path)).includes(edited))
    assert.deepEqual(errors, [])
    console.log(
        'PASS native Nuxt dev hydration, inferred form editing and draft save without publication',
    )
    success = true
} catch (error) {
    console.error(logs.slice(-16000))
    throw error
} finally {
    await browser?.close()
    database?.close()
    if (child && child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32')
            spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
                windowsHide: true,
                stdio: 'ignore',
            })
        else child.kill('SIGTERM')
        await Promise.race([once(child, 'close'), new Promise((done) => setTimeout(done, 5000))])
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
    assert.equal(dirname(consumer), temporary)
    assert.ok(basename(consumer).startsWith('liry24-native-dev-'))
    if (success) rmSync(consumer, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    else console.error('Retained synthetic consumer:', consumer)
}

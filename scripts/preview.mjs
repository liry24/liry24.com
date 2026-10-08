import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'

import { previewTarget, repository, workerName } from './preview-target.mjs'

const [action, branch] = process.argv.slice(2)
assert(
    ['deploy', 'delete'].includes(action),
    'Usage: node scripts/preview.mjs deploy|delete <branch>',
)
const target = previewTarget(branch)
const environment = {
    ...process.env,
    CLOUDFLARE_API_TOKEN:
        process.env.CLOUDFLARE_API_TOKEN ?? process.env.PREVIEW_CLOUDFLARE_API_TOKEN,
    CI: 'true',
    CF_SEND_TELEMETRY: 'false',
    WRANGLER_SEND_METRICS: 'false',
}

function run(executable, args, { input, json = false, env = environment } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (data) => {
            stdout += data
        })
        child.stderr.on('data', (data) => {
            stderr += data
            process.stderr.write(data)
        })
        child.on('error', reject)
        child.on('close', (code) => {
            if (code !== 0)
                return reject(
                    new Error(
                        `${executable} ${args.slice(0, 4).join(' ')} failed (${code}): ${stderr || stdout}`,
                    ),
                )
            try {
                resolve(json && stdout.trim() ? JSON.parse(stdout) : stdout)
            } catch (error) {
                reject(error)
            }
        })
        child.stdin.end(input)
    })
}

const cf = (...args) => run(process.execPath, ['node_modules/cf/bin/cf', ...args], { json: true })
const wranglerPreview = (args, input) =>
    run(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], { input })
const listDatabase = async () => {
    const databases = await cf('d1', 'list', '--name', target.resourceName)
    assert(Array.isArray(databases), 'Unexpected D1 list response')
    const exact = databases.filter((database) => database.name === target.resourceName)
    assert(exact.length <= 1, 'Ambiguous Preview database')
    return exact[0]
}
const listBucket = async () => {
    const result = await cf('r2', 'buckets', 'list', '--name-contains', target.resourceName)
    assert(Array.isArray(result.buckets), 'Unexpected R2 list response')
    return result.buckets.find((bucket) => bucket.name === target.resourceName)
}

await run('git', ['check-ref-format', '--branch', branch])
const remote = await run('git', [
    'ls-remote',
    '--heads',
    `https://github.com/${repository}.git`,
    `refs/heads/${branch}`,
])

if (action === 'deploy') {
    assert(remote.trim(), 'The branch must exist on GitHub before deployment')
    if (process.env.GITHUB_SHA && remote.split(/\s/)[0] !== process.env.GITHUB_SHA) {
        console.log('Skipping a superseded push.')
        process.exit(0)
    }
    const secrets = {
        BETTER_AUTH_SECRET: process.env.PREVIEW_BETTER_AUTH_SECRET,
        GITHUB_CLIENT_ID: process.env.PREVIEW_GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.PREVIEW_GITHUB_CLIENT_SECRET,
        PREVIEW_GITHUB_TOKEN: process.env.PREVIEW_GITHUB_TOKEN,
    }
    for (const [name, value] of Object.entries(secrets))
        assert(value, `Missing Preview secret: ${name}`)
    let database = await listDatabase()
    if (!database) database = await cf('d1', 'create', '--name', target.resourceName)
    assert(
        database.name === target.resourceName && database.uuid,
        'Unexpected Preview database identity',
    )
    if (!(await listBucket())) await cf('r2', 'buckets', 'create', '--name', target.resourceName)
    Object.assign(environment, {
        CLOUDFLARE_PREVIEW_BUILD: 'true',
        APP_ENV: 'preview',
        PREVIEW_URL: target.url,
        PREVIEW_D1_ID: database.uuid,
        PREVIEW_RESOURCE_NAME: target.resourceName,
        NUXT_PUBLIC_SITE_URL: target.url,
    })
    // Build with public Preview metadata only. OAuth/authentication credentials stay runtime bindings.
    const buildEnvironment = Object.fromEntries(
        Object.entries(environment).filter(([name]) =>
            /^(?:PATH|HOME|TMPDIR|CI|NODE_OPTIONS|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|CF_SEND_TELEMETRY|WRANGLER_SEND_METRICS|CLOUDFLARE_PREVIEW_BUILD|APP_ENV|PREVIEW_URL|PREVIEW_D1_ID|PREVIEW_RESOURCE_NAME|NUXT_PUBLIC_SITE_URL)$/.test(
                name,
            ),
        ),
    )
    await run('bun', ['--no-env-file', 'run', 'build'], { env: buildEnvironment })
    // Validate the actual emitted v2 Worker on isolated local D1/R2 before any remote changes.
    await run(
        process.execPath,
        ['node_modules/vitest/vitest.mjs', 'run', 'tests/worker/built-app.test.ts'],
        { env: { ...buildEnvironment, LIRY24_TEST_BUILT_WORKER: 'true' } },
    )
    // cf supports Drizzle's nested SQL layout; local Drizzle history is kept separate.
    await run(process.execPath, [
        'node_modules/cf/bin/cf',
        'd1',
        'migrations',
        'apply',
        database.uuid,
        '--dir',
        'drizzle',
        '--pattern',
        'drizzle/*/migration.sql',
    ])
    const secretInput = JSON.stringify(secrets)
    await wranglerPreview(
        ['preview', 'base-config', 'secret', 'bulk', '--worker-name', workerName],
        secretInput,
    )
    // Wrangler's structured output excludes log lines and secret values.
    await mkdir('.cloudflare', { recursive: true })
    const outputPath = resolve('.cloudflare/preview-deploy-output.jsonl')
    await writeFile(outputPath, '')
    await run(
        process.execPath,
        [
            'node_modules/wrangler/bin/wrangler.js',
            'preview',
            '--worker-name',
            workerName,
            '--name',
            target.name,
            '--json',
        ],
        { env: { ...environment, WRANGLER_OUTPUT_FILE_PATH: outputPath } },
    )
    const records = (await readFile(outputPath, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    const deployed = records.find((record) => record.type === 'preview')
    assert(
        deployed?.worker_name === workerName &&
            deployed.preview_name === target.name &&
            deployed.preview_urls?.includes(target.url),
        'Unexpected Preview deployment target',
    )
    // Base secrets only initialize new Previews. Refresh existing ones on every deployment too.
    await wranglerPreview(
        ['preview', 'secret', 'bulk', '--worker-name', workerName, '--name', target.name],
        secretInput,
    )
    await writeFile(
        '.cloudflare/preview-result.json',
        JSON.stringify(
            { ...deployed, databaseId: database.uuid, bucket: target.resourceName },
            null,
            2,
        ),
    )
    if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(
            process.env.GITHUB_STEP_SUMMARY,
            `Preview: [${target.name}](${target.url})\n\nD1 / R2: \`${target.resourceName}\`\n`,
        )
    console.log(`Preview ready: ${target.url}`)
} else {
    assert(!remote.trim(), 'Refusing to delete resources for an existing branch')
    assert(target.resourceName.startsWith(`${workerName}-p-`), 'Not a Preview resource')
    try {
        await wranglerPreview([
            'preview',
            'delete',
            '--worker-name',
            workerName,
            '--name',
            target.name,
            '--skip-confirmation',
        ])
    } catch (error) {
        // Wrangler's Preview-not-found code; authentication and other failures must stop cleanup.
        if (!/\[code: 10025\]/.test(String(error))) throw error
    }
    if (await listBucket()) {
        let job = await cf(
            'r2',
            'objects',
            'bulk-delete',
            '--bucket-name',
            target.resourceName,
            '--prefix=',
            // cf beta requires a body even in prefix mode; the API ignores it in that mode.
            '--body',
            '[]',
            '--force',
        )
        const deadline = Date.now() + 10 * 60 * 1000
        while (job.status !== 'COMPLETED') {
            assert(
                job.id && !['FAILED', 'CANCELLED'].includes(job.status) && Date.now() < deadline,
                'R2 empty job failed or timed out',
            )
            await setTimeout(3000)
            job = await cf(
                'r2',
                'buckets',
                'jobs',
                'get',
                job.id,
                '--bucket-name',
                target.resourceName,
            )
        }
        await cf('r2', 'buckets', 'delete', target.resourceName, '--force')
    }
    const database = await listDatabase()
    if (database) await cf('d1', 'delete', database.uuid, '--force')
    assert(!(await listDatabase()) && !(await listBucket()), 'Preview resources still exist')
    console.log(`Deleted Preview resources: ${target.resourceName}`)
}

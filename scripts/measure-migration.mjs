import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { init, parse } from 'es-module-lexer'

const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true })
        .filter((entry) => !['.wrangler', '.cache'].includes(entry.name))
        .flatMap((entry) =>
            entry.isDirectory()
                ? walk(resolve(directory, entry.name))
                : [resolve(directory, entry.name)],
        )
const sizes = (files) => ({
    files: files.length,
    bytes: files.reduce((sum, path) => sum + readFileSync(path).length, 0),
    gzipBytes: files.reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0),
})
const output = (directory) => {
    const files = walk(directory).filter((path) => !/\.(map|br|gz)$/.test(path))
    return {
        all: sizes(files),
        js: sizes(files.filter((path) => /\.m?js$/.test(path))),
        css: sizes(files.filter((path) => /\.css$/.test(path))),
        wasm: sizes(files.filter((path) => /\.wasm$/.test(path))),
    }
}
export async function measureHtml(html, publicDirectory = '.output/public') {
    await init
    const files = new Set()
    const visit = (path) => {
        if (files.has(path) || !existsSync(path)) return
        files.add(path)
        for (const imported of parse(readFileSync(path, 'utf8'))[0]) {
            if (imported.d === -1 && imported.n?.startsWith('.'))
                visit(resolve(dirname(path), imported.n))
        }
    }
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+\.js)"[^>]*>/g)) {
        if (match[0].includes('prefetch')) continue
        const pathname = new URL(match[1], 'http://localhost').pathname
        if (pathname.startsWith('/_nuxt/')) visit(resolve(publicDirectory, '.' + pathname))
    }
    const formLoaded = [...files].some((path) =>
        readFileSync(path, 'utf8').includes('One tag per line'),
    )
    return { ...sizes([...files]), formLoaded }
}
const source = (repository, before) => {
    const args = before
        ? ['ls-tree', '-r', '--name-only', 'HEAD']
        : ['ls-files', '--cached', '--others', '--exclude-standard']
    const paths = [
        ...new Set(
            execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim().split('\n'),
        ),
    ].filter((path) => /\.(ts|vue|m?js|sql)$/.test(path))
    let files = 0,
        lines = 0
    for (const path of paths) {
        if (!before && !existsSync(resolve(repository, path))) continue
        const content = before
            ? execFileSync('git', ['show', 'HEAD:' + path], { cwd: repository, encoding: 'utf8' })
            : readFileSync(resolve(repository, path), 'utf8')
        files++
        lines += content.trimEnd().split('\n').length
    }
    return { files, lines }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const result = {
        baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        note: 'Byte counts exclude maps and precompressed duplicates. Gzip is per-file summed, not wire traffic. Source compares HEAD to working tree and includes pre-existing edits.',
        bundles: Object.fromEntries(
            [
                ['beforeHome', '.data/baseline/apps/home/.output'],
                ['beforeAdmin', '.data/baseline/apps/admin/.output'],
                ['after', '.output'],
            ].map(([name, directory]) => [
                name,
                { public: output(directory + '/public'), server: output(directory + '/server') },
            ]),
        ),
        source: {
            application: { before: source('.', true), after: source('.', false) },
            library: {
                before: source('../site-admin', true),
                after: source('../site-admin', false),
            },
        },
        publicPages: {},
        baselinePublicPages: {},
    }
    const origin = process.argv[2] || 'http://localhost:8787'
    assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
    for (const path of ['/', '/arts', '/works', '/posts']) {
        const response = await fetch(new URL(path, origin))
        assert(response.ok)
        result.publicPages[path] = await measureHtml(await response.text())
        assert(
            !result.publicPages[path].formLoaded,
            'Admin editor leaked into public initial imports',
        )
        const previous =
            '.data/baseline/apps/home/.output/public' +
            (path === '/' ? '/index.html' : path + '/index.html')
        if (existsSync(previous))
            result.baselinePublicPages[path] = await measureHtml(
                readFileSync(previous, 'utf8'),
                '.data/baseline/apps/home/.output/public',
            )
    }
    console.log(JSON.stringify(result, null, 2))
}

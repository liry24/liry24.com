import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { Cookie, Locator, Page } from 'playwright-core'
import { expect } from 'vitest'
import { z } from 'zod'

import type { GameRecordData } from '../../shared/types/content'
import { gameFieldsSchema, mediaReferenceSchema } from '../../shared/utils/contentSchemas'
import type { builtWorker } from './builtWorker'

type BuiltWorker = Awaited<ReturnType<typeof builtWorker>>

export interface FormSeedPayload {
    id?: string
    data: object
    body?: string
}

export const ARTWORK_TITLE = 'Accessibility artwork'
export const ARTWORK_PATH = '/arts?open=accessibility-artwork'
export const POST_PATH = '/posts/synthetic-game-mention'
export const ATTACHED_PROFILE = 'https://example.invalid/apex'

export async function multipartRequest(
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

export async function seedGameCatalog(
    db: BuiltWorker['env']['DB'],
    id: string,
    game: GameRecordData,
) {
    await db
        .prepare('INSERT INTO game_catalog (id, igdb_id, slug, data) VALUES (?, ?, ?, ?)')
        .bind(id, game.igdbId, game.slug, JSON.stringify(game))
        .run()
}

export async function submitAndPublish(
    app: BuiltWorker,
    headers: Record<string, string>,
    formName: string,
    collection: string,
    payload: FormSeedPayload,
) {
    const jsonHeaders = { 'content-type': 'application/json', ...headers }
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
        body: JSON.stringify({ action: 'publish', collection, id: saved.id }),
    })
    expect(publishResponse.status, await publishResponse.clone().text()).toBe(200)
    return saved.id
}

export function toPlaywrightCookies(cookieHeader: string, url: URL): Array<Cookie> {
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

export function observeBrowserErrors(
    page: Page,
    origin: string,
    errors: Array<string>,
    label = '',
) {
    page.on('pageerror', (error) => {
        errors.push(`${label}${page.url()}: ${error.message}`)
    })
    page.on('console', (message) => {
        const text = message.text()
        if (/hydration.*mismatch|non-element root|NUXT_E400[23]/i.test(text))
            errors.push(`${label}${page.url()}: ${text}`)
    })
    page.on('response', (response) => {
        if (response.status() >= 500 && new URL(response.url()).origin === origin)
            errors.push(`${label}${response.url()}: ${response.status()}`)
    })
}

export async function expectFocus(locator: Locator) {
    await expect
        .poll(() => locator.evaluate((element) => element === document.activeElement))
        .toBe(true)
}

export async function seedBrowserFixtures(app: BuiltWorker, admin: Record<string, string>) {
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
                positions: [{ label: 'Immortal', value: 2100, color: '#FF4655' }],
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
        metrics: [{ key: 'rank', label: 'Rank', format: 'integer', positions: [] }],
    })
    await seedGameCatalog(app.env.DB, valorantId, valorantGame)
    await seedGameCatalog(app.env.DB, apexId, apexGame)

    await submitAndPublish(app, admin, 'game-stats', 'gameStats', {
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

    await submitAndPublish(app, admin, 'game-stats', 'gameStats', {
        data: {
            game: apexId,
            periodKey: 's23',
            period: 'S23',
            order: 0,
            href: ATTACHED_PROFILE,
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

    await submitAndPublish(app, admin, 'art', 'arts', {
        data: {
            title: ARTWORK_TITLE,
            slug: 'accessibility-artwork',
            images: [uploadedMedia],
            description: 'Synthetic artwork for accessibility audit.',
            order: 0,
        },
    })

    await submitAndPublish(app, admin, 'work', 'works', {
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

    await submitAndPublish(app, admin, 'skill', 'skills', {
        id: 'typescript',
        data: {
            name: 'TypeScript',
            icon: 'simple-icons:typescript',
            category: 'Language',
            order: 0,
        },
    })

    await submitAndPublish(app, admin, 'skill', 'skills', {
        id: 'vue',
        data: {
            name: 'Vue',
            icon: 'simple-icons:vuedotjs',
            category: 'Framework',
            order: 1,
        },
    })

    await submitAndPublish(app, admin, 'post', 'posts', {
        id: 'synthetic-game-mention',
        data: {
            title: 'Played :game[valorant]',
            plainTitle: 'Played VALORANT',
            slug: 'synthetic-game-mention',
            tags: ['dev'],
            gameMentions: [],
            order: 0,
        },
        body: 'Introduction with :game[valorant].\n\nFull synthetic article body with :game[valorant].',
    })

    return { fixtureBytes, uploadedMedia }
}

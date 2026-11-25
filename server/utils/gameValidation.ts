import { createError } from 'nuxt/server'

import type { GameRecordData, GameStatsRecordData, PostData } from '../../shared/schemas/content.js'
import type { GameMetric } from '../../shared/types/games.js'
import { gameTitleParts, postGameSlugs } from '../../shared/utils/gameMentions.js'
import { gameValueIssues } from '../../shared/utils/games.js'
import content from '../content.js'
import { listAllCollectionItems } from './content.js'
import { gameCatalog } from './gameCatalog.js'

function invalidField(message: string): never {
    throw createError({ status: 400, statusText: message, message })
}

export async function preparePostData(input: {
    data: PostData
    body: string
    previousAuthorUserId?: string
    actorUserId?: string
}): Promise<PostData> {
    const slugs = await postGameSlugs(input.data.title, input.body)
    const gameDocs = slugs.length ? await gameCatalog().list() : []
    const bySlug = new Map(gameDocs.map((doc) => [doc.data.slug, doc]))
    const matchedIds: Array<string> = []
    for (const slug of slugs) {
        const doc = bySlug.get(slug)
        if (!doc) {
            invalidField('Choose an imported game for every game mention.')
        }
        matchedIds.push(doc.id)
    }
    const plainTitle = gameTitleParts(input.data.title)
        .map((part) => {
            if (!part.slug) {
                return part.text
            }
            const matchedDoc = bySlug.get(part.slug)
            return matchedDoc?.data.name ?? part.text
        })
        .join('')
    return {
        ...input.data,
        plainTitle,
        gameMentions: matchedIds,
        authorUserId: input.previousAuthorUserId ?? input.actorUserId ?? input.data.authorUserId,
    }
}

export async function validateGameSave(options: {
    id: string
    data: GameRecordData
    previous: GameRecordData
}) {
    const { id, data, previous } = options
    const metricKeys = new Set(data.metrics.map((item) => item.key))
    if (metricKeys.size !== data.metrics.length) {
        invalidField('Metric keys must be unique.')
    }
    if (data.primaryMetric && !data.metrics.some((item) => item.key === data.primaryMetric)) {
        invalidField('Choose an existing metric.')
    }
    for (const metric of data.metrics) {
        for (const position of metric.positions ?? []) {
            const issues = gameValueIssues([metric], [{ ...position, key: metric.key }])
            const firstIssue = issues[0]
            if (firstIssue) {
                invalidField(firstIssue)
            }
        }
    }

    if (
        previous.igdbId !== data.igdbId ||
        previous.slug !== data.slug ||
        previous.name !== data.name
    ) {
        invalidField('IGDB identity cannot be edited. Import the game from search.')
    }

    const stats = await gameStatsEntries()
    const recordedKeys = new Set(
        stats
            .filter((doc) => doc.data.game === id)
            .flatMap((doc) => (Array.isArray(doc.data.values) ? doc.data.values : []))
            .map((entry) =>
                entry &&
                typeof entry === 'object' &&
                'key' in entry &&
                typeof entry.key === 'string'
                    ? entry.key
                    : '',
            ),
    )
    for (const key of recordedKeys) {
        if (!key) {
            continue
        }
        const before = previous.metrics.find((metric) => metric.key === key)
        const after = data.metrics.find((metric) => metric.key === key)
        if (
            !after ||
            after.format !== before?.format ||
            (after.unit || '') !== (before?.unit || '')
        ) {
            invalidField(`Keep the key, format and unit of recorded metric ${key}.`)
        }
    }
}

export async function validateGameStatsSave(options: {
    id: string
    data: Omit<GameStatsRecordData, 'order'>
}) {
    const { id, data } = options
    if (data.start && data.end && Date.parse(data.start) > Date.parse(data.end)) {
        invalidField('End must follow start.')
    }
    const game = await gameCatalog().get(data.game)
    if (!game) {
        invalidField('Choose a saved game.')
    }

    const metrics: Array<GameMetric> = Array.isArray(game.data.metrics) ? game.data.metrics : []
    const issues = gameValueIssues(metrics, data.values)
    const firstIssue = issues[0]
    if (firstIssue) {
        invalidField(firstIssue)
    }

    const existing = await listAllCollectionItems(content.collection('gameStats'), 'draft')
    for (const doc of existing) {
        if (doc.id === id) {
            continue
        }
        if (doc.data.game === data.game && doc.data.periodKey === data.periodKey) {
            invalidField('A stat period with this game and periodKey already exists.')
        }
    }
}

async function gameStatsEntries() {
    const stats = content.collection('gameStats')
    const [draft, published] = await Promise.all([
        listAllCollectionItems(stats, 'draft'),
        listAllCollectionItems(stats, 'published'),
    ])
    return [...draft, ...published]
}

export async function validateGameRemoval(id: string) {
    const posts = content.collection('posts')
    const [stats, draftPosts, publishedPosts] = await Promise.all([
        gameStatsEntries(),
        listAllCollectionItems(posts, 'draft'),
        listAllCollectionItems(posts, 'published'),
    ])
    if (
        stats.some((item) => item.data.game === id) ||
        [...draftPosts, ...publishedPosts].some((item) => item.data.gameMentions?.includes(id))
    ) {
        throw createError({ status: 409, statusText: 'Game is referenced by Game Stats or Posts' })
    }
}

export async function validateSocialSave(options: { id: string; slug: string }) {
    const existing = await listAllCollectionItems(content.collection('socials'), 'draft')
    for (const doc of existing) {
        if (doc.id !== options.id && doc.data.slug === options.slug) {
            invalidField('A social link with this slug already exists.')
        }
    }
}

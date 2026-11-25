import { createError, defineEventHandler, readBody } from 'nuxt/server'
import { z } from 'zod'

import {
    gameFieldsSchema,
    gameStatsFieldsSchema,
    rankFieldsSchema,
} from '../../../../shared/schemas/content.js'
import type { GameRecordData, GameStatsRecordData } from '../../../../shared/schemas/content.js'
import content from '../../../content.js'
import { requireAdminSession } from '../../../utils/auth.js'
import { listAllCollectionItems } from '../../../utils/content.js'
import { gameCatalog } from '../../../utils/gameCatalog.js'

const rankId = 'legacy-ranks-1'
const gameId = 'igdb-126459'
const periodId = `${gameId}-v25a6`
const rankMetric = { key: 'rank', label: 'Rank', format: 'integer', positions: [] } as const

function conflict(message: string): never {
    throw createError({ status: 409, statusText: 'Game content migration conflict', message })
}

export default defineEventHandler(async (event) => {
    const session = await requireAdminSession(event)
    event.res.headers.set('Cache-Control', 'private, no-store')
    if (
        event.req.headers.get('origin') !== event.url.origin ||
        !event.req.headers.get('content-type')?.startsWith('application/json')
    ) {
        throw createError({ status: 403, statusText: 'Same-origin JSON request required' })
    }
    const input = z
        .object({ action: z.enum(['inspect', 'copy', 'retire']) })
        .safeParse(await readBody(event))
    if (!input.success) {
        throw createError({ status: 400, statusText: 'Choose inspect, copy, or retire' })
    }

    const games = content.collection('games')
    const ranks = content.collection('ranks')
    const stats = content.collection('gameStats')
    const [publishedGames, draftGames, publishedRanks, draftRanks, gameSchedules, rankSchedules] =
        await Promise.all([
            listAllCollectionItems(games, 'published'),
            listAllCollectionItems(games, 'draft'),
            listAllCollectionItems(ranks, 'published'),
            listAllCollectionItems(ranks, 'draft'),
            content.schedules({ collection: 'games' }),
            content.schedules({ collection: 'ranks' }),
        ])
    const gameDocs = new Map([...publishedGames, ...draftGames].map((doc) => [doc.id, doc.data]))
    const report = {
        games: [...gameDocs.keys()],
        publishedRanks: publishedRanks.map((doc) => doc.id),
        draftRanks: draftRanks.map((doc) => doc.id),
        schedules: [...new Set([...gameSchedules, ...rankSchedules].map((item) => item.id))],
    }
    if (input.data.action === 'inspect') {
        return report
    }
    if (report.schedules.length) {
        conflict('Resolve outstanding game or rank schedules before migrating.')
    }
    if ([...publishedRanks, ...draftRanks].some((doc) => doc.id !== rankId)) {
        conflict('Review additional rank documents before migrating.')
    }

    const metadata = { actorUserId: session.user.id }
    const catalog = gameCatalog()
    const publishedRank = publishedRanks[0]
    if (!publishedRank && draftRanks.length) {
        conflict('Review the unpublished rank before migrating.')
    }
    let rankGame: GameRecordData | undefined
    let period: GameStatsRecordData | undefined
    if (publishedRank) {
        const rank = rankFieldsSchema.parse(publishedRank.data)
        const state = await ranks.status(rankId)
        if (state?.draft && state.draft !== state.published) {
            conflict('Review the rank draft before migrating.')
        }
        const game = gameFieldsSchema.safeParse(gameDocs.get(gameId))
        if (
            !game.success ||
            game.data.slug !== 'valorant' ||
            rank.game.toLowerCase() !== game.data.slug ||
            rank.season !== 'V25A6' ||
            rank.rank !== 'Immortal 1'
        ) {
            conflict('This migration expects the reviewed VALORANT V25A6 rank and saved game.')
        }
        const metric = game.data.metrics.find((entry) => entry.key === rankMetric.key)
        if (metric && (metric.format !== rankMetric.format || metric.unit)) {
            conflict('The saved rank metric differs from the migration metric.')
        }
        rankGame = {
            ...game.data,
            primaryMetric: rankMetric.key,
            metrics: metric
                ? game.data.metrics
                : [...game.data.metrics, { ...rankMetric, positions: [] }],
        }
        period = {
            game: gameId,
            periodKey: 'v25a6',
            period: rank.season,
            order: Math.trunc(rank.order),
            values: [{ key: rankMetric.key, value: 22, label: rank.rank, image: rank.image }],
            href: rank.href,
        }
        gameDocs.set(gameId, rankGame)
    }

    if (input.data.action === 'retire') {
        if (publishedRank) {
            const saved = await stats.get(periodId, { ref: 'published' })
            const migrated = await catalog.get(gameId)
            if (
                !saved ||
                !migrated ||
                !period ||
                JSON.stringify(gameStatsFieldsSchema.parse(saved.data)) !==
                    JSON.stringify(gameStatsFieldsSchema.parse(period)) ||
                migrated.data.primaryMetric !== rankMetric.key
            ) {
                conflict('Verify the copied and published Game Stats before retiring Ranks.')
            }
            const state = await ranks.status(rankId)
            if (state?.draft) {
                if (state.draft !== state.published) conflict('The rank changed during retirement.')
                await ranks.remove(rankId, { ifDigest: state.draft })
            }
            await content.publish({
                expect: [{ collection: 'ranks', id: rankId, digest: null }],
                metadata,
            })
        }
        return report
    }

    const parsedGames = [...gameDocs].map(
        ([id, data]) => [id, gameFieldsSchema.parse(data)] as const,
    )
    if (period && rankGame) {
        const duplicate = (await listAllCollectionItems(stats, 'draft')).find(
            (entry) =>
                entry.id !== periodId &&
                entry.data.game === gameId &&
                entry.data.periodKey === period.periodKey,
        )
        if (duplicate) conflict('A Game Stats period for V25A6 already exists under another ID.')
        const [gameState, statState, existingPeriod] = await Promise.all([
            games.status(gameId),
            stats.status(periodId),
            stats.get(periodId, { ref: 'draft' }),
        ])
        if (
            existingPeriod &&
            JSON.stringify(gameStatsFieldsSchema.parse(existingPeriod.data)) !==
                JSON.stringify(gameStatsFieldsSchema.parse(period))
        ) {
            conflict('Review the existing Game Stats at the migration ID.')
        }
        const savedGame = await games.save(
            gameId,
            { data: rankGame },
            { ifDigest: gameState?.draft ?? null },
        )
        const savedStat = await stats.save(
            periodId,
            { data: period },
            { ifDigest: statState?.draft ?? null },
        )
        await content.publish({
            expect: [
                { collection: 'games', id: gameId, digest: savedGame.digest },
                { collection: 'gameStats', id: periodId, digest: savedStat.digest },
            ],
            metadata,
        })
    }
    for (const [id, data] of parsedGames) {
        await catalog.insert(id, data)
        const copied = await catalog.get(id)
        if (JSON.stringify(copied?.data) !== JSON.stringify(data)) {
            conflict(`Review the existing catalog entry for ${id}.`)
        }
    }
    return { ...report, period: period ? periodId : null }
})

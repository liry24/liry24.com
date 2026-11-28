import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const gameStatsGameConfigSchema = z.object({
    igdbId: z.number().int().positive(),
    primaryMetric: z.string().optional(),
    metrics: z.array(gameMetricSchema).max(30),
})

const gameStatsFormSchema = z.object({
    id: z.string().optional(),
    data: gameStatsFieldsSchema
        .partial({ game: true, periodKey: true })
        .extend({ order: z.number().int().optional() }),
    gameConfig: gameStatsGameConfigSchema.optional(),
})

export default defineForm({
    schema: gameStatsFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const { id, data, gameConfig } = submission.data
            if (!gameConfig) {
                const gameId = data.game?.trim()
                if (!gameId) throw createError({ status: 400, statusText: 'Choose a valid game.' })

                const saved = await saveEntryDraft(content.collection('gameStats'), {
                    id,
                    data,
                    key: 'periodKey',
                    fields: (periodKey, order) => ({ ...data, game: gameId, periodKey, order }),
                    label: data.period,
                    idPrefix: `${gameId}-`,
                    sameScope: (entry) => entry.game === gameId,
                    validate: (docId, entry) => validateGameStatsSave({ id: docId, data: entry }),
                })
                return Response.json({ id: saved.id }, { status: 201 })
            }

            const games = gameCatalog()
            const existing = await games.byIgdbId(gameConfig.igdbId)
            if (existing && data.game && data.game !== existing.id)
                throw createError({ status: 400, statusText: 'Game identity does not match.' })

            let resolvedGameId: string
            let nextGameData: GameRecordData
            let remoteGame: GameSearchResult | undefined

            if (existing) {
                resolvedGameId = existing.id
                nextGameData = {
                    ...existing.data,
                    primaryMetric: gameConfig.primaryMetric || undefined,
                    metrics: gameConfig.metrics,
                }
            } else {
                remoteGame = await resolveRemoteCatalogGame({ id: gameConfig.igdbId })
                resolvedGameId = catalogGameId(remoteGame.igdbId)
                if (data.game && data.game !== resolvedGameId)
                    throw createError({ status: 400, statusText: 'Game identity does not match.' })

                nextGameData = gameFieldsSchema.parse({
                    igdbId: remoteGame.igdbId,
                    slug: remoteGame.slug,
                    name: remoteGame.name,
                    cover: remoteGame.cover ?? undefined,
                    order: 0,
                    primaryMetric: gameConfig.primaryMetric || undefined,
                    metrics: gameConfig.metrics,
                })
            }

            await validateGameMetrics({
                gameId: existing?.id,
                metrics: nextGameData.metrics,
                primaryMetric: nextGameData.primaryMetric,
                previousMetrics: existing?.data.metrics,
                ignoreDraftStatId: id?.trim() || undefined,
            })

            const saved = await saveEntryDraft(content.collection('gameStats'), {
                id,
                data,
                key: 'periodKey',
                fields: (periodKey, order) => ({
                    ...data,
                    game: resolvedGameId,
                    periodKey,
                    order,
                }),
                label: data.period,
                idPrefix: `${resolvedGameId}-`,
                sameScope: (entry) => entry.game === resolvedGameId,
                validate: (docId, entry) =>
                    validateGameStatsSave({ id: docId, data: entry, game: nextGameData }),
                async beforeSave() {
                    if (existing) {
                        if (!hasGameConfigDiff(existing.data, nextGameData)) return

                        if (!(await games.update(existing.id, existing.data, nextGameData))) {
                            throw createError({
                                status: 409,
                                statusText: 'The game changed. Reload and try again.',
                            })
                        }
                        return
                    }
                    if (!remoteGame)
                        throw createError({ status: 404, statusText: 'Game not found in IGDB' })

                    const inserted = await insertCatalogGame(remoteGame, {
                        primaryMetric: nextGameData.primaryMetric,
                        metrics: nextGameData.metrics,
                    })
                    if (hasGameConfigDiff(inserted.data, nextGameData)) {
                        const merged: GameRecordData = {
                            ...inserted.data,
                            primaryMetric: nextGameData.primaryMetric,
                            metrics: nextGameData.metrics,
                        }
                        if (
                            inserted.data.metrics.length > 0 ||
                            !(await games.update(inserted.id, inserted.data, merged))
                        ) {
                            throw createError({
                                status: 409,
                                statusText: 'The game changed. Reload and try again.',
                            })
                        }
                    }
                },
            })

            return Response.json({ id: saved.id, gameId: resolvedGameId }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

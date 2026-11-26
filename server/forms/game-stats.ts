import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const gameStatsFormSchema = z.object({
    id: z.string().optional(),
    data: gameStatsFieldsSchema
        .partial({ periodKey: true })
        .extend({ order: z.number().int().optional() }),
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
            const { id, data } = submission.data
            const saved = await saveEntryDraft(content.collection('gameStats'), {
                id,
                data,
                key: 'periodKey',
                fields: (periodKey, order) => ({ ...data, periodKey, order }),
                label: data.period,
                idPrefix: `${data.game}-`,
                sameScope: (entry) => entry.game === data.game,
                validate: (id, data) => validateGameStatsSave({ id, data }),
            })
            return Response.json({ id: saved.id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

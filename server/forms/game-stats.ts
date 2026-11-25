import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { gameStatsFieldsSchema } from '../../shared/schemas/content.js'
import content from '../content.js'
import { saveOrderedDraft } from '../utils/content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'
import { validateGameStatsSave } from '../utils/gameValidation.js'

const gameStatsFormSchema = z.object({
    id: z.string().optional(),
    data: gameStatsFieldsSchema.extend({ order: z.number().int().optional() }),
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
            const id = normalizeDocumentId(
                submission.data.id,
                `${submission.data.data.game}-${submission.data.data.periodKey}`,
            )
            await validateGameStatsSave({ id, data: submission.data.data })
            await saveOrderedDraft(content.collection('gameStats'), id, submission.data.data)
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { gameFieldsSchema } from '../../shared/schemas/content.js'
import content from '../content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'
import { validateGameSave } from '../utils/gameValidation.js'

const gameFormSchema = z.object({
    id: z.string().optional(),
    data: gameFieldsSchema,
})

export default defineForm({
    schema: gameFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(
                submission.data.id,
                `igdb-${submission.data.data.igdbId}`,
            )
            const games = content.collection('games')
            const existing = await games.get(id, { ref: 'draft' })
            const previousParsed = existing ? gameFieldsSchema.safeParse(existing.data) : null

            await validateGameSave({
                id,
                data: submission.data.data,
                previous: previousParsed?.success ? previousParsed.data : undefined,
            })

            await games.save(id, { data: submission.data.data })
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

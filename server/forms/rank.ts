import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { rankFieldsSchema } from '../../shared/schemas/content.js'
import content from '../content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'

const rankFormSchema = z.object({
    id: z.string().optional(),
    data: rankFieldsSchema,
})

export default defineForm({
    schema: rankFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(
                submission.data.id,
                submission.data.data.slug || submission.data.data.game,
            )
            await content.collection('ranks').save(id, { data: submission.data.data })
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

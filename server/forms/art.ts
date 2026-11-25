import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { artFieldsSchema } from '../../shared/schemas/content.js'
import content from '../content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'

const artFormSchema = z.object({
    id: z.string().optional(),
    data: artFieldsSchema,
})

export default defineForm({
    schema: artFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(submission.data.id, submission.data.data.slug)
            await content.collection('arts').save(id, { data: submission.data.data })
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

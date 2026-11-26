import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const workFormSchema = z.object({
    id: z.string().optional(),
    data: workFieldsSchema.extend({ order: z.number().finite().optional() }),
})

export default defineForm({
    schema: workFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(submission.data.id, submission.data.data.slug)
            await saveOrderedDraft(content.collection('works'), id, submission.data.data)
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

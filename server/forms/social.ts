import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const socialFormSchema = z.object({
    id: z.string().optional(),
    data: socialFieldsSchema.extend({ order: z.number().finite().optional() }),
})

export default defineForm({
    schema: socialFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(submission.data.id, submission.data.data.slug)
            await validateSocialSave({ id, slug: submission.data.data.slug })
            await saveOrderedDraft(content.collection('socials'), id, submission.data.data)
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { socialFieldsSchema } from '../../shared/schemas/content.js'
import content from '../content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'
import { validateSocialSave } from '../utils/gameValidation.js'

const socialFormSchema = z.object({
    id: z.string().optional(),
    data: socialFieldsSchema,
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
            await content.collection('socials').save(id, { data: submission.data.data })
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

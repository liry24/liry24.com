import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { skillFieldsSchema } from '../../shared/utils/contentSchemas.js'
import content from '../content.js'
import { saveOrderedDraft } from '../utils/content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'

const skillFormSchema = z.object({
    id: z.string().optional(),
    data: skillFieldsSchema.extend({ order: z.number().finite().optional() }),
})

export default defineForm({
    schema: skillFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(submission.data.id, submission.data.data.slug)
            await saveOrderedDraft(content.collection('skills'), id, submission.data.data)
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

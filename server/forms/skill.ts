import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

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
            const { id, data } = submission.data
            const savedId = await saveUnkeyedEntryDraft(content.collection('skills'), {
                id,
                order: data.order,
                fields: (order) => ({ ...data, order }),
            })
            return Response.json({ id: savedId }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

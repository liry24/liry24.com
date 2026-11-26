import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const careerFormSchema = z.object({
    id: z.string().optional(),
    data: careerFieldsSchema
        .partial({ slug: true })
        .extend({ order: z.number().finite().optional() }),
})

export default defineForm({
    schema: careerFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const { id, data } = submission.data
            const saved = await saveEntryDraft(content.collection('careers'), {
                id,
                data,
                key: 'slug',
                fields: (slug, order) => ({ ...data, slug, order }),
                label: data.company,
            })
            return Response.json({ id: saved.id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

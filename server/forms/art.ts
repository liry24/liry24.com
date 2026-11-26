import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const artFormSchema = z.object({
    id: z.string().optional(),
    data: artFieldsSchema.partial({ slug: true }).extend({ order: z.number().finite().optional() }),
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
            const { id, data } = submission.data
            const saved = await saveEntryDraft(content.collection('arts'), {
                id,
                data,
                key: 'slug',
                fields: (slug, order) => ({ ...data, slug, order }),
                label: data.title,
            })
            return Response.json({ id: saved.id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

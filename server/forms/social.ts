import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const socialFormSchema = z.object({
    id: z.string().optional(),
    data: socialFieldsSchema
        .partial({ slug: true })
        .extend({ order: z.number().finite().optional() }),
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
            const { id, data } = submission.data
            const saved = await saveEntryDraft(content.collection('socials'), {
                id,
                data,
                key: 'slug',
                fields: (slug, order) => ({ ...data, slug, order }),
                label: data.label,
                allowGeneratedKey: socialSlug,
                validate: (id, entry) => validateSocialSave({ id, slug: entry.slug }),
            })
            return Response.json({ id: saved.id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

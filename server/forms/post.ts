import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { postFieldsSchema } from '../../shared/utils/contentSchemas.js'
import content from '../content.js'
import { authorizeAdminForm, handleFormDomainError, normalizeDocumentId } from '../utils/forms.js'
import { preparePostData } from '../utils/gameValidation.js'

const postFormSchema = z.object({
    id: z.string().optional(),
    data: postFieldsSchema,
    body: z.string(),
})

export default defineForm({
    schema: postFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const id = normalizeDocumentId(submission.data.id, submission.data.data.slug)
            const posts = content.collection('posts')
            const existing = await posts.get(id, { ref: 'draft' })
            const previousAuthorUserId =
                typeof existing?.data.authorUserId === 'string'
                    ? existing.data.authorUserId
                    : undefined

            const data = await preparePostData({
                data: submission.data.data,
                body: submission.data.body,
                previousAuthorUserId,
                actorUserId: submission.user?.id,
            })

            await posts.save(id, {
                data,
                body: submission.data.body,
            })
            return Response.json({ id }, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

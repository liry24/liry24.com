import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const postFormSchema = z.object({
    id: z.string().optional(),
    data: postFieldsSchema.partial({ slug: true }),
    body: z.string(),
})

const reservedSlugs = new Set(['cards', 'new'])
const availableSlug = (slug: string) => !reservedSlugs.has(slug.toLowerCase())

export default defineForm({
    schema: postFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const { id, data, body } = submission.data
            const posts = content.collection('posts')
            const games = await resolvePostGames(data.title, body)

            const saved = await saveEntryDraft(posts, {
                id,
                data,
                body,
                key: 'slug',
                label: games.plainTitle,
                allowGeneratedKey: availableSlug,
                fields: (slug, order, previous) => ({
                    ...data,
                    ...games,
                    slug,
                    order,
                    authorUserId:
                        previous?.authorUserId ?? submission.user?.id ?? data.authorUserId,
                }),
                async validate(id, entry, previous) {
                    if (entry.slug === previous?.slug) return
                    if (!availableSlug(entry.slug) || !availableSlug(id)) {
                        throw createError({
                            status: 400,
                            statusText: 'Choose a different post slug.',
                        })
                    }
                    if (!submission.data.id?.trim()) return

                    const entries = await listAllCollectionItems(posts, 'draft')
                    if (
                        entries.some(
                            (post) =>
                                post.id !== id &&
                                (post.id === entry.slug || post.data.slug === entry.slug),
                        )
                    ) {
                        throw createError({
                            status: 409,
                            statusText: 'A post with this slug already exists.',
                        })
                    }
                },
            })
            return Response.json(saved, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

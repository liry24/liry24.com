import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import content from '#server/content'

const postFormSchema = z.object({
    id: z.string().optional(),
    data: postFieldsSchema.omit({ generateSlugOnPublish: true }).partial({ slug: true }),
    body: z.string(),
    mentionedGames: z
        .array(
            z.object({
                slug: z.string().regex(gameSlugPattern),
                igdbId: z.number().int().positive(),
            }),
        )
        .max(100)
        .optional(),
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
            const { id, data, body, mentionedGames } = submission.data
            const posts = content.collection('posts')
            const games = await resolvePostGames(data.title, body, mentionedGames)
            const checkSlug = !id?.trim() || data.slug !== undefined
            const [occupied, published] = checkSlug
                ? await Promise.all([
                      listPostSlugOwners(),
                      listAllCollectionItems(posts, 'published'),
                  ])
                : [new Map<string, string>(), []]
            for (const post of published) {
                for (const path of [post.id, post.data.slug]) {
                    const key = path.toLowerCase()
                    if (!occupied.has(key)) occupied.set(key, post.id)
                }
            }

            const saved = await saveEntryDraft(posts, {
                id,
                data,
                body,
                key: 'slug',
                label: games.plainTitle,
                generateKey: fallbackPostSlug,
                suffixGeneratedKey: suffixPostSlug,
                allowGeneratedKey: (slug) => isPostSlugAllowed(slug) && !occupied.has(slug),
                fields: (slug, order, previous) => ({
                    ...data,
                    plainTitle: games.plainTitle,
                    gameMentions: games.gameMentions,
                    slug,
                    generateSlugOnPublish:
                        data.slug === undefined
                            ? (previous?.generateSlugOnPublish ?? (previous ? undefined : true))
                            : undefined,
                    order,
                    authorUserId:
                        previous?.authorUserId ?? submission.user?.id ?? data.authorUserId,
                }),
                async validate(id, entry, previous) {
                    if (entry.slug === previous?.slug) return
                    if (!isPostSlugAllowed(entry.slug) || !isPostSlugAllowed(id)) {
                        throw createError({
                            status: 400,
                            statusText: 'Choose a different post slug.',
                        })
                    }
                    const paths = [id.toLowerCase(), entry.slug.toLowerCase()]
                    if (
                        paths.some(
                            (path) =>
                                occupied.has(path) && (!previous || occupied.get(path) !== id),
                        )
                    )
                        throw postSlugConflict()

                    if (data.slug === undefined) return

                    const entries = await listAllCollectionItems(posts, 'draft')
                    if (
                        entries.some(
                            (post) =>
                                post.id !== id &&
                                [post.id, post.data.slug].some(
                                    (path) =>
                                        typeof path === 'string' &&
                                        paths.includes(path.toLowerCase()),
                                ),
                        )
                    )
                        throw postSlugConflict()
                },
                beforeSave: () => games.persistMissingGames(),
            })
            return Response.json(saved, { status: 201 })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

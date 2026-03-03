import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

import { artImages, arts, careers, posts, postTags, ranks, skills, socials, works } from './schema'

export const socialsSelectSchema = createSelectSchema(socials)
export const socialsInsertSchema = createInsertSchema(socials).omit({ id: true })
export const socialsUpdateSchema = createUpdateSchema(socials)
export type Social = z.infer<typeof socialsSelectSchema>

export const careersSelectSchema = createSelectSchema(careers)
export const careersInsertSchema = createInsertSchema(careers).omit({ id: true })
export const careersUpdateSchema = createUpdateSchema(careers)
export type Career = z.infer<typeof careersSelectSchema>

export const artImagesSelectSchema = createSelectSchema(artImages).partial({
    id: true,
    artSlug: true,
    alt: true,
})
export const artImagesInsertSchema = createInsertSchema(artImages, {
    src: () => z.url(),
}).omit({ id: true })
export const artImagesUpdateSchema = createUpdateSchema(artImages, {
    src: () => z.url(),
}).omit({ id: true })
export type ArtImage = z.infer<typeof artImagesSelectSchema>

export const artsSelectSchema = createSelectSchema(arts).extend({
    images: artImagesSelectSchema
        .omit({
            artSlug: true,
        })
        .partial({
            id: true,
            alt: true,
        })
        .array(),
})
export const artsInsertSchema = createInsertSchema(arts, {
    slug: (s) => s.optional(),
    title: (s) => s.min(1),
}).extend({
    images: artImagesInsertSchema.omit({ artSlug: true }).array().min(1),
})
export const artsUpdateSchema = createUpdateSchema(arts, {
    slug: (s) => s.optional(),
    title: (s) => s.min(1),
}).extend({
    images: artImagesUpdateSchema
        .omit({ artSlug: true })
        .required({ src: true })
        .array()
        .optional(),
})
export type Art = z.infer<typeof artsSelectSchema>

export const worksSelectSchema = createSelectSchema(works, {
    createdAt: z.iso.datetime(),
})
export const worksInsertSchema = createInsertSchema(works, {
    slug: (s) => s.optional(),
    createdAt: () => z.iso.datetime().optional(),
    title: (s) => s.min(1),
    sortIndex: (s) => s.optional(),
})
export const worksUpdateSchema = createUpdateSchema(works, {
    slug: (s) => s.optional(),
    createdAt: () => z.iso.datetime().optional(),
    title: (s) => s.min(1),
    sortIndex: (s) => s.optional(),
})
export type Work = z.infer<typeof worksSelectSchema>

export const skillsSelectSchema = createSelectSchema(skills)
export const skillsInsertSchema = createInsertSchema(skills).omit({ id: true })
export const skillsUpdateSchema = createUpdateSchema(skills)
export type Skill = z.infer<typeof skillsSelectSchema>

export const ranksSelectSchema = createSelectSchema(ranks)
export const ranksInsertSchema = createInsertSchema(ranks).omit({ id: true })
export const ranksUpdateSchema = createUpdateSchema(ranks)
export type Rank = z.infer<typeof ranksSelectSchema>

export const postTagsSelectSchema = createSelectSchema(postTags)
export const postTagsInsertSchema = createInsertSchema(postTags, {
    tag: (s) => s.min(1),
})
export const postTagsUpdateSchema = createUpdateSchema(postTags, {
    tag: (s) => s.min(1),
})
export type PostTag = z.infer<typeof postTagsSelectSchema>

export const postsSelectSchema = createSelectSchema(posts).extend({
    tags: postTagsSelectSchema.omit({ postSlug: true }).array(),
})
export const postsInsertSchema = createInsertSchema(posts, {
    slug: (s) => s.optional(),
    title: (s) => s.min(1, { error: 'Title is required' }),
    content: (s) => s.min(1, { error: 'Content is required' }),
}).extend({
    tags: z.string().array().optional(),
})
export const postsUpdateSchema = createUpdateSchema(posts, {
    slug: (s) => s.optional(),
    title: (s) => s.min(1),
    content: (s) => s.min(1),
}).extend({
    tags: z.string().array().min(1).optional(),
})
export type Post = z.infer<typeof postsSelectSchema>

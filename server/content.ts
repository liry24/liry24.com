import { cms } from 'vite-hub/cms'
import { defineContent, image, optional } from 'vite-hub/content'
import { documents } from 'vite-hub/content/collections'

export const content = defineContent({
    extends: [cms, { database: 'default', blob: 'default' }],
    access: 'public',
    authorize: ({ user }) => isAdminUser(user),
    collections: {
        posts: documents({
            path: 'content/posts/**/*.md',
            url: ({ data }) => `/posts/${encodeURIComponent(data.slug)}`,
            fields: {
                ...postFieldsSchema.shape,
                cover: optional(image()),
            },
        }),
        works: documents({
            path: 'content/works/**/*.json',
            fields: {
                ...workFieldsSchema.shape,
                image: optional(image()),
            },
        }),
        arts: documents({
            path: 'content/arts/**/*.json',
            fields: artFieldsSchema.shape,
        }),
        careers: documents({
            path: 'content/careers/**/*.json',
            titleField: 'company',
            fields: careerFieldsSchema.shape,
        }),
        skills: documents({
            path: 'content/skills/**/*.json',
            fields: skillFieldsSchema.shape,
        }),
        gameStats: documents({
            path: 'content/game-stats/**/*.json',
            titleField: 'period',
            fields: gameStatsFieldsSchema.shape,
        }),
        socials: documents({
            path: 'content/socials/**/*.json',
            titleField: 'label',
            fields: socialFieldsSchema.shape,
        }),
    },
})

export default content

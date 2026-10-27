import { contentCollection } from '@litijs/model/content'
import { defineContent } from 'vite-hub/content'
import { cms } from 'vite-hub/content/presets/cms'

import { posts, works, arts, careers, skills } from './models/content'

export const content = defineContent({
    extends: [cms, { blob: 'content' }],
    collections: {
        posts: contentCollection(posts),
        works: contentCollection(works),
        arts: contentCollection(arts),
        careers: contentCollection(careers),
        skills: contentCollection(skills),
    },
    seo: { sitemap: false, robots: false },
    authorize: ({ user }) => user?.role === 'admin',
})

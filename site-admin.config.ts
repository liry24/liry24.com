import { openai } from '@ai-sdk/openai'
import {
    array,
    datetime,
    defineSiteAdminConfig,
    image,
    images,
    markdown,
    object,
    select,
    text,
    textarea,
    url,
} from '@liria24/site-admin'
import { z } from 'zod'

import { getSiteAdminDatabase } from './server/utils/database.ts'
import {
    postEditorialOptions,
    postSlugOutput,
    postSlugPrompt,
    postProofreadingOutput,
    postProofreadingPrompt,
} from './server/utils/postEditorial.ts'
import { postMarkdownSecurity } from './shared/utils/postMarkdown.ts'

export default defineSiteAdminConfig({
    markdown: { plugins: [postMarkdownSecurity] },
    storage: {
        content: {
            adapter: 'r2',
            // Nitro parses the SDK's generated config as JavaScript.
            config: () => ({ binding: Reflect.get(Object(process.env), 'R2') }),
        },
    },
    $development: {
        storage: {
            content: {
                adapter: 'fs',
                config: { root: '.data/files/content' },
            },
        },
    },
    assets: {
        storage: 'content',
        separateDrafts: false,
        cleanup: { minimumAge: 60 * 60 * 24 },
    },
    database: getSiteAdminDatabase,
    ai: {
        model: openai('gpt-6-luna'),
        actions: {
            publication: {
                type: 'text-generation',
                input: z.strictObject({
                    title: z.string().refine((value) => Boolean(value.trim()), 'Write a title.'),
                    content: z.string().refine((value) => Boolean(value.trim()), 'Write content.'),
                }),
                prompt: postSlugPrompt,
                output: postSlugOutput(),
                options: postEditorialOptions,
            },
            proofread: {
                type: 'text-generation',
                input: z.strictObject({
                    content: z.string().refine((value) => Boolean(value.trim()), 'Write content.'),
                }),
                prompt: postProofreadingPrompt,
                output: postProofreadingOutput,
                options: postEditorialOptions,
            },
        },
    },
    seo: { titleTemplate: '%s | Liry24' },
    routeRules: {
        '/': {
            seo: {
                title: 'Liry24',
                titleTemplate: null,
                description: 'Personal website of Liry24.',
                image: {
                    component: 'Home.takumi',
                    props: { title: 'Liry24' },
                    options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
                },
            },
        },
        '/arts': {
            seo: {
                title: 'Arts',
                description: 'A collection of artworks by Liry24.',
                image: {
                    component: 'Home.takumi',
                    props: { title: 'Liry24', subpath: 'arts' },
                    options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
                },
            },
        },
        '/works': {
            seo: {
                title: 'Works',
                description: 'A collection of works by Liry24.',
                image: {
                    component: 'Home.takumi',
                    props: { title: 'Liry24', subpath: 'works' },
                    options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
                },
            },
        },
        '/posts': {
            seo: {
                title: 'Posts',
                description: 'Blog posts by Liry24.',
                image: {
                    component: 'Home.takumi',
                    props: { title: 'Liry24', subpath: 'posts' },
                    options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
                },
            },
        },
    },
    models: {
        works: {
            sortable: true,

            displayFields: { title: 'title', description: 'description', image: 'image' },
            fields: {
                slug: text({ default: '' }),
                title: text({ required: true }),
                description: textarea(),
                category: text(),
                image: image(),
                icon: text(),
                href: url({ label: 'URL' }),
                price: text(),
                style: select(['large', 'small'], { required: true, default: 'small' }),
                createdAt: datetime(),
            },
        },
        arts: {
            sortable: true,

            displayFields: { title: 'title', description: 'description' },
            fields: {
                slug: text({ default: '' }),
                title: text({ required: true }),
                description: textarea(),
                href: url({ label: 'URL' }),
                images: images({ required: true }),
                createdAt: datetime(),
            },
        },
        careers: {
            sortable: true,

            displayFields: { title: 'company' },
            fields: {
                slug: text({ default: '' }),
                period: text({ required: true }),
                position: text({ required: true }),
                company: text({ required: true }),
            },
        },
        ranks: {
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: true,

            displayFields: { title: 'game', image: 'image' },
            fields: {
                slug: text({ default: '' }),
                game: text({ required: true }),
                season: text(),
                rank: text({ required: true }),
                image: image({ required: true }),
                href: url({ label: 'URL' }),
            },
        },
        skills: {
            sortable: true,

            displayFields: { title: 'name' },
            fields: {
                slug: text({ default: '' }),
                name: text({ required: true }),
                icon: text({ required: true }),
                category: text(),
            },
        },
        socials: {
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: true,

            displayFields: { title: 'label' },
            route: { path: '/:slug', redirect: 'href', sitemap: false, llms: false },
            fields: {
                slug: text({ default: '' }),
                href: url({ required: true, label: 'URL' }),
                icon: text({ required: true }),
                label: text({ required: true }),
            },
        },
        posts: {
            route: '/posts/:slug',
            seo: { type: 'article' },
            displayFields: { title: 'title', description: 'content', image: 'image' },
            fields: {
                slug: text({ default: '' }),
                title: text({ required: true }),
                content: markdown({ required: true }),
                publication: object({
                    slug: select(['auto', 'manual']),
                    publishedSlug: text(),
                }),
                tags: array(text(), { required: true, default: [] }),
                image: image(),
                authorUserId: text(),
                createdAt: datetime(),
            },
        },
    },
})

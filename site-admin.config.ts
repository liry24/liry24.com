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

import { postAiActions } from './server/ai/posts.ts'
import { postMarkdownSecurity } from './shared/utils/postMarkdown.ts'

export default defineSiteAdminConfig({
    tasks: {
        publishDue: process.env.APP_ENV === 'production' ? '* * * * *' : true,
        rebuildSearch: true,
    },
    models: {
        works: {
            meta: {
                label: 'Work',
                plural: 'Works',
                icon: 'mingcute:package-2-fill',
                fields: ['slug', 'category', 'description', 'price', 'href', 'style'],
            },
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
            meta: {
                label: 'Art',
                plural: 'Arts',
                icon: 'mingcute:pic-fill',
                fields: ['slug', 'href'],
            },
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
            meta: {
                label: 'Career',
                plural: 'Careers',
                icon: 'mingcute:suitcase-fill',
                fields: ['period', 'position'],
            },
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
            meta: {
                label: 'Rank',
                plural: 'Ranks',
                icon: 'mingcute:chess-fill',
                fields: ['season', 'rank'],
            },
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
            meta: {
                label: 'Skill',
                plural: 'Skills',
                icon: 'mingcute:award-fill',
                fields: ['category'],
            },
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
            meta: {
                label: 'Social',
                plural: 'Socials',
                icon: 'mingcute:link-fill',
                fields: ['href'],
            },
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
            meta: {
                label: 'Post',
                plural: 'Posts',
                icon: 'mingcute:book-3-fill',
                fields: ['slug'],
            },
            route: '/posts/:slug',
            seo: { type: 'article' },
            displayFields: { title: 'title', description: 'content', image: 'image' },
            fields: {
                slug: text({ default: '', i18n: true }),
                title: text({ required: true, i18n: true }),
                content: markdown({ required: true, i18n: true }),
                publication: object(
                    {
                        slug: select(['auto', 'manual']),
                        publishedSlug: text(),
                    },
                    { i18n: true },
                ),
                tags: array(text(), { required: true, default: [] }),
                image: image(),
                authorUserId: text(),
                createdAt: datetime(),
            },
        },
    },

    markdown: { plugins: [postMarkdownSecurity] },

    assets: {
        storage: 'content',
        separateDrafts: false,
        cleanup: { minimumAge: 60 * 60 * 24 },
    },

    ai: {
        model: openai('gpt-6-luna'),
        actions: postAiActions,
    },

    seo: {
        titleTemplate: '%s | Liry24',
    },

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
})

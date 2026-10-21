import { openai } from '@ai-sdk/openai'
import { ai } from '@litijs/ai'
import { aiSdk } from '@litijs/ai/ai-sdk'
import { blog } from '@litijs/blog'
import { voidAdapter } from '@litijs/void'
import breaks from 'comark/plugins/breaks'
import {
    array,
    datetime,
    defineLitiConfig,
    image,
    images,
    object,
    number,
    relation,
    select,
    text,
    textarea,
    url,
} from 'liti'

import { prepareEntrySlug } from './server/utils/entryPreparation.ts'
import {
    validateGame,
    validateGameStats,
    preparePostGames,
    prepareGame,
    prepareGameStats,
} from './server/utils/gameValidation.ts'
import { postAiActions } from './server/utils/posts.ts'
import { gameColorPattern, metricKeyPattern, gameSlugPattern } from './shared/utils/games.ts'
import { postMarkdownSecurity } from './shared/utils/postMarkdown.ts'

export default defineLitiConfig({
    adapter: voidAdapter(),
    plugins: [
        ai({ provider: aiSdk({ text: openai('gpt-6-luna') }), actions: postAiActions }),
        blog({
            models: {
                posts: {
                    meta: {
                        label: 'Post',
                        plural: 'Posts',
                        icon: 'mingcute:book-3-fill',
                        fields: ['slug'],
                    },
                    i18n: true,
                    mapping: { cover: 'image', authoredAt: 'createdAt' },
                    slug: { mode: 'auto', action: 'publication' },
                    proofreading: { action: 'proofread', guard: 'pending' },
                    seo: (entry) => ({ title: String(entry.data.plainTitle || entry.data.title) }),
                    prepare: preparePostGames,
                    fields: {
                        plainTitle: text({ i18n: true }),
                        gameMentions: array(relation('games'), { default: [], i18n: true }),
                        authorUserId: text(),
                    },
                },
            },
        }),
    ],
    tasks: {
        publishDue: process.env.APP_ENV === 'production' ? '* * * * *' : true,
        rebuildSearch: true,
    },
    models: {
        works: {
            preparePublication: prepareEntrySlug('title'),
            meta: {
                label: 'Work',
                plural: 'Works',
                icon: 'mingcute:package-2-fill',
                fields: ['slug', 'category', 'description', 'price', 'href', 'style'],
            },
            sortable: true,
            displayFields: { title: 'title', description: 'description', image: 'image' },
            fields: {
                title: text({ required: true }),
                image: image(),
                slug: text({ default: '' }),
                description: textarea(),
                category: text(),
                icon: text(),
                href: url({ label: 'URL' }),
                price: text(),
                style: select(['large', 'small'], { required: true, default: 'small' }),
                createdAt: datetime(),
            },
        },
        arts: {
            preparePublication: prepareEntrySlug('title'),
            meta: {
                label: 'Art',
                plural: 'Arts',
                icon: 'mingcute:pic-fill',
                fields: ['slug', 'href'],
            },
            sortable: true,
            displayFields: { title: 'title', description: 'description' },
            fields: {
                title: text({ required: true }),
                images: images({ required: true }),
                slug: text({ default: '' }),
                description: textarea(),
                href: url({ label: 'URL' }),
                createdAt: datetime(),
            },
        },
        careers: {
            preparePublication: prepareEntrySlug('company'),
            meta: {
                label: 'Career',
                plural: 'Careers',
                icon: 'mingcute:suitcase-fill',
                fields: ['period', 'position'],
            },
            sortable: true,
            displayFields: { title: 'company' },
            fields: {
                company: text({ required: true }),
                slug: text({ default: '' }),
                period: text({ required: true }),
                position: text({ required: true }),
            },
        },
        ranks: {
            prepare: prepareEntrySlug('game'),
            meta: {
                label: 'Rank',
                plural: 'Legacy Ranks',
                icon: 'mingcute:chess-fill',
                fields: ['season', 'rank'],
            },
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: true,
            displayFields: { title: 'game', image: 'image' },
            fields: {
                game: text({ required: true }),
                image: image({ required: true }),
                slug: text({ default: '' }),
                season: text(),
                rank: text({ required: true }),
                href: url({ label: 'URL' }),
            },
        },

        games: {
            unique: [['igdbId'], ['slug']],
            meta: {
                label: 'Game',
                plural: 'Games',
                icon: 'mingcute:game-2-fill',
                fields: ['slug'],
            },
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: true,
            route: false,
            displayFields: { title: 'name', image: 'icon' },
            validate: validateGame,
            prepare: prepareGame,
            fields: {
                slug: text({ required: true, pattern: gameSlugPattern.source }),
                igdbId: number({ required: true, integer: true, min: 1 }),
                name: text({ required: true, minLength: 1 }),
                cover: url(),
                icon: image(),
                primaryMetric: text(),
                metrics: array(
                    object(
                        {
                            key: text({ required: true, pattern: metricKeyPattern.source }),
                            label: text({ required: true, minLength: 1 }),
                            format: select(['integer', 'decimal', 'percent'], { required: true }),
                            unit: text(),
                            positions: array(
                                object(
                                    {
                                        value: number({ required: true, min: 0 }),
                                        label: text({ required: true, minLength: 1 }),
                                        image: image(),
                                        color: text({ pattern: gameColorPattern.source }),
                                    },
                                    { required: true },
                                ),
                                { default: [], maxItems: 100 },
                            ),
                        },
                        { required: true },
                    ),
                    { default: [], maxItems: 30 },
                ),
            },
        },
        gameStats: {
            unique: [['game', 'periodKey']],
            meta: {
                label: 'Game Stats',
                plural: 'Game Stats',
                icon: 'mingcute:chess-fill',
                fields: ['periodKey'],
            },
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: true,
            route: false,
            displayFields: { title: 'period' },
            validate: validateGameStats,
            prepare: async (context) => {
                await prepareGameStats(context)
                prepareEntrySlug('period')(context)
            },
            fields: {
                slug: text({ default: '' }),
                game: relation('games', { required: true }),
                periodKey: text({ required: true }),
                period: text({ required: true }),
                order: number({ required: true, integer: true, default: 0 }),
                start: datetime(),
                end: datetime(),
                values: array(
                    object(
                        {
                            key: text({ required: true }),
                            value: number({ required: true, min: 0 }),
                            label: text(),
                            image: image(),
                            color: text({ pattern: gameColorPattern.source }),
                        },
                        { required: true },
                    ),
                    { required: true, default: [], maxItems: 30 },
                ),
                href: url({ label: 'URL' }),
            },
        },
        skills: {
            preparePublication: prepareEntrySlug('name'),
            meta: {
                label: 'Skill',
                plural: 'Skills',
                icon: 'mingcute:award-fill',
                fields: ['category'],
            },
            sortable: true,
            displayFields: { title: 'name' },
            fields: {
                name: text({ required: true }),
                slug: text({ default: '' }),
                icon: text({ required: true }),
                category: text(),
            },
        },
        socials: {
            prepare: prepareEntrySlug('label'),
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
                label: text({ required: true }),
                slug: text({ default: '' }),
                href: url({ required: true, label: 'URL' }),
                icon: text({ required: true }),
            },
        },
    },

    markdown: {
        plugins: [postMarkdownSecurity, breaks()],
        summary: { inlineTags: ['game-mention'] },
    },

    assets: {
        storage: 'content',
        separateDrafts: false,
        cleanup: { minimumAge: 60 * 60 * 24 },
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

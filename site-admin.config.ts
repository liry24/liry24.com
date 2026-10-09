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

export default defineSiteAdminConfig({
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
    database: async (context) => {
        const { getSiteAdminDatabase } = await import('./server/utils/database.ts')
        return getSiteAdminDatabase(context)
    },
    ai: {
        model: async (context) => {
            const { getWorkersAIModel } = await import('./server/utils/workersAI.ts')
            return getWorkersAIModel(context)
        },
        models: {
            posts: {
                publication: async (action) => {
                    const { postPublicationAction } =
                        await import('./server/utils/postEditorial.ts')
                    const { postMetadataModes } = await import('./shared/utils/postEditorial.ts')
                    let publishedSlug: string | undefined
                    if (
                        action.entry.publishedRevisionId &&
                        postMetadataModes(action.entry.data).slug === 'auto'
                    ) {
                        const { useSiteAdmin } = await import('@liria24/site-admin/nuxt/server')
                        const admin = await useSiteAdmin(undefined, action.context?.platformContext)
                        const revisions = await admin.listRevisions(action.entry.id)
                        publishedSlug = revisions.find(
                            (revision) => revision.id === action.entry.publishedRevisionId,
                        )?.slug
                        if (!publishedSlug) {
                            const { SiteAdminError } = await import('@liria24/site-admin')
                            throw new SiteAdminError(
                                'SITE_ADMIN_CONFLICT',
                                'The published URL could not be confirmed. Reload the latest post.',
                            )
                        }
                    }
                    return postPublicationAction(action, publishedSlug)
                },
                proofread: async ({ entry, ai, context }) => {
                    const { proofreadPost } = await import('./server/utils/postEditorial.ts')
                    return proofreadPost(ai, entry.data, context?.request?.signal)
                },
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
                title: text({ required: true }),
                description: textarea(),
                category: text(),
                image: image(),
                icon: text(),
                href: url(),
                price: text(),
                style: select(['large', 'small'], { required: true, default: 'small' }),
                createdAt: datetime(),
            },
        },
        arts: {
            sortable: true,

            displayFields: { title: 'title', description: 'description' },
            fields: {
                title: text({ required: true }),
                description: textarea(),
                href: url(),
                images: images({ required: true }),
                createdAt: datetime(),
            },
        },
        careers: {
            sortable: true,

            displayFields: { title: 'company' },
            fields: {
                period: text({ required: true }),
                position: text({ required: true }),
                company: text({ required: true }),
            },
        },
        ranks: {
            sortable: true,

            displayFields: { title: 'game', image: 'image' },
            fields: {
                game: text({ required: true }),
                season: text(),
                rank: text({ required: true }),
                image: image({ required: true }),
                href: url(),
            },
        },
        skills: {
            sortable: true,

            displayFields: { title: 'name' },
            fields: {
                name: text({ required: true }),
                icon: text({ required: true }),
                category: text(),
            },
        },
        socials: {
            sortable: true,

            displayFields: { title: 'label' },
            route: { path: '/:slug', redirect: 'href', sitemap: false, llms: false },
            fields: {
                href: url({ required: true }),
                icon: text({ required: true }),
                label: text({ required: true }),
            },
        },
        posts: {
            route: '/posts/:slug',
            seo: { type: 'article' },
            displayFields: { title: 'title', description: 'excerpt', image: 'image' },
            fields: {
                title: text({ required: true }),
                excerpt: textarea(),
                content: markdown({ required: true }),
                publication: object({
                    slug: select(['auto', 'manual']),
                    excerpt: select(['auto', 'manual']),
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

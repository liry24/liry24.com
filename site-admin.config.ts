import {
    array,
    datetime,
    defineSiteAdminConfig,
    image,
    images,
    markdown,
    select,
    text,
    textarea,
    url,
} from '@liria24/site-admin'

export default defineSiteAdminConfig({
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
            displayFields: { title: 'title', description: 'excerpt', image: 'image' },
            fields: {
                title: text({ required: true }),
                excerpt: textarea(),
                content: markdown({ required: true }),
                tags: array(text(), { required: true, default: [] }),
                image: image(),
                authorUserId: text(),
                createdAt: datetime(),
            },
        },
    },
})

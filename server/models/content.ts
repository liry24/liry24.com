import { defineArticle, slugFromTitle } from '@litijs/blog'
import {
    defineContentModel,
    field,
    type ModelSaveInput,
    type ModelValidationContext,
} from '@litijs/model'
import { image } from '@vite-hub/blob/reference'
import { optional } from '@vite-hub/content/collections'
import { z } from 'zod'

import { imageSchema } from '../utils/imageSchema.js'
import { modelActivity } from '../utils/modelActivity.js'
import { modelAuthorization, preparePostGames } from '../utils/modelValidation.js'

const text = () => field(z.string().optional())
const slug = () => field(z.string().min(1))
const picture = () => field(optional(image()), { input: 'image' })
const date = () => field(z.iso.datetime({ offset: true }).optional(), { input: 'date' })
const prepareSlug = (key: string) => (input: ModelSaveInput, context: ModelValidationContext) => ({
    ...input,
    data: {
        ...input.data,
        slug:
            input.data.slug ||
            context.previous?.slug ||
            `${slugFromTitle(String(input.data[key] ?? '')) || 'entry'}-${context.id}`,
    },
})
const path =
    (name: string) =>
    ({ data }: { data: { slug: string } }) =>
        `/${name}/${encodeURIComponent(data.slug)}`

export const posts = defineArticle({
    name: 'posts',
    label: 'Posts',
    locales: { default: 'ja', supported: ['ja'] },
    authorize: modelAuthorization,
    committed: modelActivity,
    url: path('posts'),
    fields: {
        plainTitle: field(z.string(), { localized: true }),
        gameMentions: field(z.array(z.string()).default([]), { localized: true }),
        authorUserId: field(z.string().optional(), { public: false }),
    },
    references: [{ path: 'gameMentions.*', model: 'games' }],
    prepare: preparePostGames,
})

export const works = defineContentModel({
    name: 'works',
    label: 'Works',
    title: 'title',
    format: 'json',
    authorize: modelAuthorization,
    committed: modelActivity,
    prepare: prepareSlug('title'),
    fields: {
        title: field(z.string().min(1)),
        slug: slug(),
        image: picture(),
        description: text(),
        category: text(),
        icon: text(),
        href: field(z.httpUrl().optional()),
        price: text(),
        style: field(z.enum(['large', 'small']).default('small')),
        authoredAt: date(),
    },
})
export const arts = defineContentModel({
    name: 'arts',
    label: 'Arts',
    title: 'title',
    format: 'json',
    authorize: modelAuthorization,
    committed: modelActivity,
    prepare: prepareSlug('title'),
    fields: {
        title: field(z.string().min(1)),
        slug: slug(),
        images: field(z.array(imageSchema).min(1), { input: 'json' }),
        description: text(),
        href: field(z.httpUrl().optional()),
        authoredAt: date(),
    },
})
export const careers = defineContentModel({
    name: 'careers',
    label: 'Careers',
    title: 'company',
    format: 'json',
    authorize: modelAuthorization,
    committed: modelActivity,
    prepare: prepareSlug('company'),
    fields: {
        company: field(z.string().min(1)),
        slug: slug(),
        period: field(z.string().min(1)),
        position: field(z.string().min(1)),
    },
})
export const skills = defineContentModel({
    name: 'skills',
    label: 'Skills',
    title: 'name',
    format: 'json',
    authorize: modelAuthorization,
    committed: modelActivity,
    prepare: prepareSlug('name'),
    fields: {
        name: field(z.string().min(1)),
        slug: slug(),
        icon: field(z.string().min(1)),
        category: text(),
    },
})

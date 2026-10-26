import { z } from 'zod'

import type { ComposerModel } from '../types/adminComposer.js'

export const composerModels = [
    'works',
    'arts',
    'careers',
    'games',
    'gameStats',
    'skills',
    'socials',
    'posts',
] as const

export const composerModelDescriptions: Record<ComposerModel, string> = {
    socials:
        'External service account or profile links intended for social presence. A service homepage, product page, or arbitrary URL alone is insufficient.',
    works: 'Projects, products, commissioned deliverables, or professional accomplishments presented as portfolio or commercial work.',
    arts: 'Standalone illustrations, 3D/CG creations, or other visual artworks. Prefer this when the artwork itself is the subject, rather than a product or project accomplishment.',
    careers:
        "The owner's personal career history, including employment, education, organizational roles, and professional milestones.",
    skills: 'Tools, languages, software, technologies, or services the owner knows or can use. Distinguish an ability from an account link or a created work.',
    games: 'The shared IGDB video games catalogue and game metric definitions. Open the dedicated editor.',
    gameStats:
        'Manually recorded video game stats, including highest rank, per Act or season. Open the dedicated editor.',
    posts: 'Blog articles and requests to create, write, edit, or manage their content.',
}
const selection = z.object({
    model: z.enum(composerModels).optional(),
    entryId: z.string().min(1).max(200).optional(),
})
export const composerItemInput = selection
    .extend({
        id: z.string().min(1).max(110),
        source: z
            .object({ start: z.number().int().min(0), end: z.number().int().min(1).max(2000) })
            .strict(),
    })
    .strict()

export const composerRequest = z
    .object({
        prompt: z.string().trim().min(1).max(2000),
        requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,90}$/),
        items: z.array(composerItemInput).min(1).max(10).optional(),
        locale: z.enum(['ja', 'en']),
        timeZone: z
            .string()
            .max(100)
            .refine((value) => {
                try {
                    new Intl.DateTimeFormat('en', { timeZone: value })
                    return true
                } catch {
                    return false
                }
            }),
        context: selection
            .strict()
            .refine((value) => !value.entryId || value.model, 'An entry needs a model')
            .optional(),
    })
    .strict()
    .refine(
        (value) =>
            !value.items ||
            (new Set(value.items.map((item) => item.id)).size === value.items.length &&
                value.items.every(
                    (item) =>
                        item.id.startsWith(value.requestId + '.') &&
                        /^\d$/.test(item.id.slice(value.requestId.length + 1)) &&
                        item.source.start < item.source.end &&
                        item.source.end <= value.prompt.length &&
                        (!item.entryId || item.model),
                )),
        'Invalid batch items',
    )

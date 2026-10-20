import type { ModelPreparationContext } from 'liti'

import { entrySlugSuggestion } from '../../shared/utils/entrySlug.js'

export const prepareEntrySlug = (title: string) => (context: ModelPreparationContext) => {
    const slug = typeof context.data.slug === 'string' ? context.data.slug.trim() : ''
    if (slug) {
        context.data.slug = slug
        return
    }
    if (context.previous?.firstPublishedAt) {
        context.issues.push({ path: 'slug', message: 'An established slug cannot be empty.' })
        return
    }
    context.data.slug = entrySlugSuggestion(String(context.data[title] ?? ''))
    if (!context.data.slug)
        context.issues.push({ path: 'slug', message: 'Enter a slug before publishing.' })
}

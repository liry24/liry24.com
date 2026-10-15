import { SiteAdminError, type EntryPrepareContext } from '@liria24/site-admin'
import { postPublicationSettings } from '~~/shared/utils/postEditorial'

import { entrySlugSuggestion } from './entrySlug'

export async function prepareEntry(
    { model, operation, value, entry, resource, features, signal }: EntryPrepareContext,
    generate: (
        input: { title: string; content: string },
        options: { signal: AbortSignal },
    ) => Promise<{ slug: string }>,
) {
    if (operation === 'save' && features.publishing) return
    let slug = typeof value.slug === 'string' ? value.slug.trim() : ''
    const settings = postPublicationSettings(value)
    const established =
        model === 'posts'
            ? postPublicationSettings(entry?.data ?? {}).publishedSlug
            : entry?.data.slug
    if (!slug && (established || entry?.publishedRevisionId))
        throw new SiteAdminError('SITE_ADMIN_INVALID_INPUT', 'An established slug cannot be empty.')
    if (!slug) {
        if (model === 'posts') {
            if (settings.slug === 'manual')
                throw new SiteAdminError(
                    'SITE_ADMIN_INVALID_INPUT',
                    'Enter a slug or use automatic generation.',
                )
            const result = await generate(
                { title: String(value.title ?? ''), content: String(value.content ?? '') },
                { signal },
            )
            slug = result.slug
        } else slug = entrySlugSuggestion(resource.display(value).title)
    }
    signal.throwIfAborted()
    if (!slug)
        throw new SiteAdminError('SITE_ADMIN_INVALID_INPUT', 'Enter a slug before publishing.')
    value.slug = slug
    if (model === 'posts') value.publication = { ...settings, publishedSlug: slug }
}

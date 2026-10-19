import { SiteAdminError } from '@liria24/site-admin'

export default defineNuxtPlugin((nuxtApp) => {
    const admin = useAdminClient()
    nuxtApp.hook(
        'site-admin:entry:prepare',
        async ({ model, operation, value, entry, resource, features, signal }) => {
            if (operation === 'save' && features.publishing) return
            let slug = typeof value.slug === 'string' ? value.slug.trim() : ''
            const settings = postPublicationSettings(value)
            const established =
                model === 'posts'
                    ? postPublicationSettings(entry?.data ?? {}).publishedSlug
                    : entry?.data.slug
            if (!slug && (established || entry?.publishedRevisionId))
                throw new SiteAdminError(
                    'SITE_ADMIN_INVALID_INPUT',
                    'An established slug cannot be empty.',
                )
            if (!slug) {
                if (model === 'posts') {
                    if (settings.slug === 'manual')
                        throw new SiteAdminError(
                            'SITE_ADMIN_INVALID_INPUT',
                            'Enter a slug or use automatic generation.',
                        )
                    const result = await admin.ai.run(
                        'publication',
                        { title: String(value.title ?? ''), content: String(value.content ?? '') },
                        { signal },
                    )
                    slug = result.slug
                } else slug = entrySlugSuggestion(resource.display(value).title)
            }
            signal.throwIfAborted()
            if (!slug)
                throw new SiteAdminError(
                    'SITE_ADMIN_INVALID_INPUT',
                    'Enter a slug before publishing.',
                )
            value.slug = slug
            if (model === 'posts') value.publication = { ...settings, publishedSlug: slug }
        },
    )
})

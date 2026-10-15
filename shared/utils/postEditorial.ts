export type PostSlugMode = 'auto' | 'manual'

export type PostPublicationSettings = { slug: PostSlugMode; publishedSlug?: string }

export function postPublicationSettings(data: Record<string, unknown>): PostPublicationSettings {
    const settings =
        data.publication && typeof data.publication === 'object' && !Array.isArray(data.publication)
            ? (data.publication as Record<string, unknown>)
            : {}
    return {
        slug: settings.slug === 'auto' ? 'auto' : 'manual',
        ...(typeof settings.publishedSlug === 'string' && settings.publishedSlug
            ? { publishedSlug: settings.publishedSlug }
            : {}),
    }
}

export type PostMetadataMode = 'auto' | 'manual'

export type PostMetadataModes = { slug: PostMetadataMode; excerpt: PostMetadataMode }
export type PostPublicationSettings = PostMetadataModes & { publishedSlug?: string }

// Older revisions have no recorded selection. Keep their metadata until the
// author explicitly chooses automatic generation, without rewriting old data.
export function postMetadataModes(data: Record<string, unknown>): PostMetadataModes {
    const settings = postPublicationSettings(data)
    return {
        slug: settings.slug,
        excerpt: settings.excerpt,
    }
}

export function postPublicationSettings(data: Record<string, unknown>): PostPublicationSettings {
    const settings =
        data.publication && typeof data.publication === 'object' && !Array.isArray(data.publication)
            ? (data.publication as Record<string, unknown>)
            : {}
    return {
        slug: settings.slug === 'auto' ? 'auto' : 'manual',
        excerpt: settings.excerpt === 'auto' ? 'auto' : 'manual',
        ...(typeof settings.publishedSlug === 'string' && settings.publishedSlug
            ? { publishedSlug: settings.publishedSlug }
            : {}),
    }
}

export function postMetadataSelection(data: Record<string, unknown>, published: boolean) {
    const modes = postMetadataModes(data)
    return {
        slug: !published && !postPublicationSettings(data).publishedSlug && modes.slug === 'auto',
        excerpt: modes.excerpt === 'auto',
    }
}

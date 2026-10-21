import type { PostPublicationSettings } from '../types/postEditorial'

export function postPublicationSettings(data: Record<string, unknown>): PostPublicationSettings {
    const settings =
        data.publication && typeof data.publication === 'object' && !Array.isArray(data.publication)
            ? (data.publication as Record<string, unknown>)
            : {}
    return {
        slug: settings.slug === 'auto' ? 'auto' : 'manual',
    }
}

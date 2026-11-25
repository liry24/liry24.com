import type { MediaReference } from '../../shared/schemas/content'

export function mediaUrl(reference: MediaReference): string
export function mediaUrl(reference: MediaReference | null | undefined): string | undefined
export function mediaUrl(reference: MediaReference | null | undefined) {
    if (!reference) {
        return undefined
    }
    const { imagesDomain, siteUrl } = useRuntimeConfig().public
    const path = reference.pathname.split('/').map(encodeURIComponent).join('/')
    return imagesDomain && imagesDomain !== siteUrl
        ? `${String(imagesDomain).replace(/\/$/, '')}/${path}`
        : `/media/${path}`
}

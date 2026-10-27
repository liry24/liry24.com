import type { BlobReference } from '@vite-hub/blob/reference'

export function mediaUrl(reference: BlobReference): string
export function mediaUrl(reference: BlobReference | null | undefined): string | undefined
export function mediaUrl(reference: BlobReference | null | undefined) {
    if (!reference) return undefined
    const { imagesDomain, siteUrl } = useRuntimeConfig().public
    const path = reference.pathname.split('/').map(encodeURIComponent).join('/')
    return imagesDomain && imagesDomain !== siteUrl
        ? `${String(imagesDomain).replace(/\/$/, '')}/${path}`
        : `/media/${path}`
}

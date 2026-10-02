import type { MarkdownDocumentProps } from '@comark/vue'
import type { InferSiteAdminPublicModels } from '@liria24/site-admin'

import type config from '../../site-admin.config'
type PublicModels = InferSiteAdminPublicModels<typeof config>
export type ContentModels = { [Name in keyof PublicModels]: PublicModels[Name]['data'] }
export type ContentEntry<Name extends keyof ContentModels> = Omit<PublicModels[Name], 'data'> & {
    data: Name extends 'posts'
        ? Omit<ContentModels[Name], 'content'> & {
              content: NonNullable<MarkdownDocumentProps['value']>
          }
        : ContentModels[Name]
}
export type ArtImage = { id: string; src: string; alt: string }
export type PublicArt = Omit<ContentModels['arts'], 'images'> & { slug: string; images: ArtImage[] }
export const presentArt = (entry: ContentEntry<'arts'>): PublicArt => ({
    ...entry.data,
    slug: entry.slug,
    images: entry.data.images.map((asset) => ({
        id: asset.id,
        src: asset.url,
        alt: asset.alt || '',
    })),
})

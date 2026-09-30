import type { MarkdownDocumentProps } from '@comark/vue'
import type { AssetInput, InferSiteAdminModels } from '@liria24/site-admin'
import type { SiteAdminClient } from '@liria24/site-admin/client'

import type config from '../../site-admin.config'
export type ContentModels = InferSiteAdminModels<typeof config>
export type ContentEntry<Name extends keyof ContentModels> = {
    id: string
    slug: string
    publishedAt: string
    data: Name extends 'posts'
        ? Omit<ContentModels[Name], 'content'> & {
              content: NonNullable<MarkdownDocumentProps['value']>
          }
        : ContentModels[Name]
}
export type ArtImage = { id: string; src: string; alt: string }
export type PublicArt = Omit<ContentModels['arts'], 'images'> & { slug: string; images: ArtImage[] }
export const contentAssetSrc = (
    asset: AssetInput | null | undefined,
    client: Pick<SiteAdminClient, 'assetUrl'>,
): string | undefined => {
    const id = typeof asset === 'string' ? asset : asset?.id
    return id ? client.assetUrl(id) : undefined
}
export const presentArt = (
    entry: ContentEntry<'arts'>,
    client: Pick<SiteAdminClient, 'assetUrl'>,
): PublicArt => ({
    ...entry.data,
    slug: entry.slug,
    images: entry.data.images.map((asset) => ({
        id: typeof asset === 'string' ? asset : asset.id,
        src: contentAssetSrc(asset, client)!,
        alt: typeof asset === 'string' ? '' : asset.alt || '',
    })),
})

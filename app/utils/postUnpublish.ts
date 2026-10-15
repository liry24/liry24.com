import { SiteAdminError, type ModelDescriptor } from '@liria24/site-admin'
import { serializeSiteAdminData, type SiteAdminManagementClient } from '@liria24/site-admin/client'
import type { EntryRecord } from '@liria24/site-admin/server'
import { postPublicationSettings } from '~~/shared/utils/postEditorial'

type PostManagement = Pick<
    SiteAdminManagementClient<Record<string, Record<string, unknown>>>,
    'listRevisions' | 'updateEntry' | 'unpublishEntry'
>

export async function unpublishPost(
    management: PostManagement,
    descriptor: ModelDescriptor,
    entry: EntryRecord,
) {
    let version = entry.version
    if (entry.publishedRevisionId) {
        const revisions = await management.listRevisions(entry.id)
        const publishedSlug = revisions.find(
            (revision) => revision.id === entry.publishedRevisionId,
        )?.slug
        if (!publishedSlug)
            throw new SiteAdminError(
                'SITE_ADMIN_CONFLICT',
                'The published URL could not be confirmed. Reload the latest post.',
            )
        const settings = postPublicationSettings(entry.data)
        if (settings.publishedSlug !== publishedSlug) {
            // Save the confirmed URL before the SDK clears the published pointer.
            // Both mutations are version guarded; a failed save prevents unpublish.
            const saved = await management.updateEntry(entry.id, {
                expectedVersion: version,
                slug: entry.slug,
                data: serializeSiteAdminData(descriptor, {
                    ...entry.data,
                    publication: { ...settings, publishedSlug },
                }),
            })
            version = saved.version
        }
    }
    return management.unpublishEntry(entry.id, { expectedVersion: version })
}

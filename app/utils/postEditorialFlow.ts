import { SiteAdminError } from '@liria24/site-admin'
import type { SiteAdminManagementClient } from '@liria24/site-admin/client'
import { postMetadataSelection, postPublicationSettings } from '~~/shared/utils/postEditorial'

export type PostDraftState = {
    entryId: string | null
    version: number | null
    draft: { data: Record<string, unknown>; slug: string }
}
export type PostDraftSnapshot = PostDraftState & { entryId: string; version: number }
export type PostMetadataInput = {
    title: string
    content: string
    generateSlug: boolean
    generateExcerpt: boolean
}
export type PostMetadataSuggestion = { slug?: string; excerpt?: string }
export type PostEditorialProposal = {
    kind: 'proofread' | 'publication'
    snapshot: PostDraftSnapshot
    data: Record<string, unknown>
    slug: string
}
type Management = Pick<
    SiteAdminManagementClient<Record<string, Record<string, unknown>>>,
    'getEntry' | 'listRevisions'
>
type Context = { management: Management; current: () => PostDraftState }

function capture(current: PostDraftState): PostDraftSnapshot {
    if (!current.entryId || current.version === null)
        throw new SiteAdminError('SITE_ADMIN_INVALID_INPUT', 'Save a draft before using AI.')
    return structuredClone({
        entryId: current.entryId,
        version: current.version,
        draft: { data: current.draft.data, slug: current.draft.slug },
    })
}

export function postProposalStale(
    proposal: Pick<PostEditorialProposal, 'snapshot'>,
    current: PostDraftState,
) {
    return (
        JSON.stringify(proposal.snapshot) !==
        JSON.stringify({
            entryId: current.entryId,
            version: current.version,
            draft: { data: current.draft.data, slug: current.draft.slug },
        })
    )
}

function assertCurrent(snapshot: PostDraftSnapshot, current: PostDraftState) {
    if (postProposalStale({ snapshot }, current))
        throw new SiteAdminError(
            'SITE_ADMIN_CONFLICT',
            'The draft changed while AI was running. Run the action again.',
        )
}

async function storedDraft({ management }: Context, snapshot: PostDraftSnapshot) {
    const entry = await management.getEntry(snapshot.entryId)
    if (entry.model !== 'posts' || entry.version !== snapshot.version)
        throw new SiteAdminError(
            'SITE_ADMIN_CONFLICT',
            'Conflict detected. Reload the latest post.',
        )
    return entry
}

export async function preparePostProofreading(
    context: Context,
    execute: (props: { content: string }) => Promise<{ content: string }>,
): Promise<PostEditorialProposal> {
    const snapshot = capture(context.current())
    await storedDraft(context, snapshot)
    assertCurrent(snapshot, context.current())
    const result = await execute({ content: String(snapshot.draft.data.content ?? '') })
    await storedDraft(context, snapshot)
    assertCurrent(snapshot, context.current())
    return {
        kind: 'proofread',
        snapshot,
        data: { ...snapshot.draft.data, content: result.content },
        slug: snapshot.draft.slug,
    }
}

export async function preparePostPublication(
    context: Context,
    execute: (props: PostMetadataInput) => Promise<PostMetadataSuggestion>,
): Promise<PostEditorialProposal> {
    const snapshot = capture(context.current())
    const entry = await storedDraft(context, snapshot)
    const settings = postPublicationSettings(snapshot.draft.data)
    let publishedSlug = postPublicationSettings(entry.data).publishedSlug
    if (settings.slug === 'auto' && entry.publishedRevisionId) {
        publishedSlug = (await context.management.listRevisions(entry.id)).find(
            (revision) => revision.id === entry.publishedRevisionId,
        )?.slug
        if (!publishedSlug)
            throw new SiteAdminError(
                'SITE_ADMIN_CONFLICT',
                'The published URL could not be confirmed. Reload the latest post.',
            )
    }
    const policyData = {
        ...snapshot.draft.data,
        publication: { ...settings, publishedSlug },
    }
    const selection = postMetadataSelection(policyData, Boolean(entry.publishedRevisionId))
    assertCurrent(snapshot, context.current())
    const generated =
        selection.slug || selection.excerpt
            ? await execute({
                  title: String(snapshot.draft.data.title ?? ''),
                  content: String(snapshot.draft.data.content ?? ''),
                  generateSlug: selection.slug,
                  generateExcerpt: selection.excerpt,
              })
            : {}
    await storedDraft(context, snapshot)
    assertCurrent(snapshot, context.current())
    return {
        kind: 'publication',
        snapshot,
        data: {
            ...snapshot.draft.data,
            ...(selection.excerpt ? { excerpt: generated.excerpt } : {}),
        },
        slug:
            settings.slug === 'manual'
                ? snapshot.draft.slug
                : (publishedSlug ?? generated.slug ?? snapshot.draft.slug),
    }
}

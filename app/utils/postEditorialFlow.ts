import { SiteAdminError } from '@liria24/site-admin'
import type { Entry } from '@liria24/site-admin'

export type PostDraftState = {
    entryId: string | null
    version: number | null
    locale?: string
    draft: Record<string, unknown>
}
export type PostDraftSnapshot = PostDraftState & { entryId: string; version: number }
export type PostEditorialProposal = {
    kind: 'proofread'
    snapshot: PostDraftSnapshot
    data: Record<string, unknown>
}
type Context = {
    management: { entries: { get: (model: 'posts', id: string) => Promise<Entry> } }
    current: () => PostDraftState
}
export async function preparePostProofreading(
    context: Context,
    execute: (input: { content: string }) => Promise<{ content: string }>,
): Promise<PostEditorialProposal> {
    const current = context.current()
    if (!current.entryId || current.version === null)
        throw new SiteAdminError('SITE_ADMIN_INVALID_INPUT', 'Save a draft before using AI.')
    const snapshot = structuredClone(current) as PostDraftSnapshot
    const assertCurrent = async () => {
        const entry = await context.management.entries.get('posts', snapshot.entryId)
        if (
            entry.model !== 'posts' ||
            entry.version !== snapshot.version ||
            JSON.stringify(snapshot) !== JSON.stringify(context.current())
        )
            throw new SiteAdminError(
                'SITE_ADMIN_CONFLICT',
                'The draft changed while AI was running. Run the action again.',
            )
    }
    await assertCurrent()
    const result = await execute({ content: String(snapshot.draft.content ?? '') })
    await assertCurrent()
    return { kind: 'proofread', snapshot, data: { ...snapshot.draft, content: result.content } }
}

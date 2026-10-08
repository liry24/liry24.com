import type { SiteAdminAIActionResult } from '@liria24/site-admin/ai'

import type { PostEditorAI } from '~/utils/postEditor'

export function usePostEditorAI(): PostEditorAI {
    const management = useSiteAdminManagementClient()
    async function propose(action: () => Promise<SiteAdminAIActionResult>) {
        try {
            const proposal = await action()
            if (proposal.issues?.length)
                throw new Error(proposal.issues.map((issue) => issue.message).join(', '))
            return proposal
        } catch (error: any) {
            throw new Error(
                error.data?.error?.message ||
                    (error.status === 404 || error.statusCode === 404
                        ? 'AI is unavailable. Your input is kept. You can enter slug and excerpt manually to save.'
                        : error.message || 'AI request failed. Your input is kept.'),
            )
        }
    }
    return {
        async generate({ data, fields, slug }) {
            const result = await propose(() =>
                management.generateMetadata('posts', {
                    data,
                    ...(slug !== undefined ? { slug } : {}),
                    generate: {
                        slug: fields.includes('slug'),
                        excerpt: fields.includes('excerpt'),
                    },
                }),
            )
            return {
                slug: result.slug,
                excerpt: typeof result.data.excerpt === 'string' ? result.data.excerpt : undefined,
            }
        },
        async proofread({ data }) {
            const result = await propose(() =>
                management.proofreadDraft('posts', { data, fields: ['content'] }),
            )
            return { content: typeof result.data.content === 'string' ? result.data.content : '' }
        },
    }
}

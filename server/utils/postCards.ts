import { parseMarkdown } from 'comark/parse'
import titleDescription from 'comark/plugins/title-description'

export function parsePostDescription(body: string) {
    return parseMarkdown(body, {
        plugins: [postMarkdownSecurity, titleDescription()],
        autoClose: false,
    })
}

export async function parsePostContent(body: string): Promise<{
    document: PostRenderedDocument
    excerpt: PostCard['excerpt']
    description: string | undefined
}> {
    const { meta, nodes } = await parsePostDescription(body)
    const content = nodes.filter((node) => Array.isArray(node) && node[0] !== 'hr')
    const paragraph = content[meta.title === undefined ? 0 : 1]
    return {
        document: { nodes, frontmatter: {}, meta: {} },
        excerpt: {
            nodes: meta.description !== undefined && paragraph ? [paragraph] : [],
            frontmatter: {},
            meta: {},
        },
        description: meta.description?.trim() || undefined,
    }
}

export async function postCards(
    entries: Array<PostItem & { digest?: string }>,
    parseContent?: (digest: string | undefined, body: string) => ReturnType<typeof parsePostContent>,
): Promise<Array<PostCard>> {
    return await Promise.all(
        entries.map(async (entry) => {
            const { excerpt } = await (
                parseContent?.(entry.digest, entry.body) ?? parsePostContent(entry.body)
            )
            const { generateSlugOnPublish: _generateSlugOnPublish, ...data } = entry.data
            return {
                ...data,
                id: entry.id,
                url: entry.url,
                date: entry.data.authoredAt ?? entry.publishedAt ?? entry.updatedAt ?? null,
                excerpt,
            }
        }),
    )
}

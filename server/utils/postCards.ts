import { parseMarkdown } from 'comark/parse'
import titleDescription from 'comark/plugins/title-description'

export function parsePostDescription(body: string) {
    return parseMarkdown(body, {
        plugins: [postMarkdownSecurity, titleDescription()],
        autoClose: false,
    })
}

export async function postCards(entries: Array<PostItem>): Promise<Array<PostCard>> {
    return await Promise.all(
        entries.map(async (entry) => {
            const { meta, nodes } = await parsePostDescription(entry.body)
            const content = nodes.filter((node) => Array.isArray(node) && node[0] !== 'hr')
            const paragraph = content[meta.title === undefined ? 0 : 1]
            const { generateSlugOnPublish: _generateSlugOnPublish, ...data } = entry.data
            return {
                ...data,
                id: entry.id,
                url: entry.url,
                date: entry.data.authoredAt ?? entry.publishedAt ?? entry.updatedAt ?? null,
                excerpt: {
                    nodes: meta.description !== undefined && paragraph ? [paragraph] : [],
                    frontmatter: {},
                    meta: {},
                },
            }
        }),
    )
}

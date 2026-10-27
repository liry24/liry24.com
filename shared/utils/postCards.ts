import { articleDates } from '@litijs/blog'
import { parseMarkdown } from 'comark/parse'
import summary from 'comark/plugins/summary'
import type { Entry } from 'liti/types'

import { postMarkdownSecurity } from './postMarkdown.js'

export async function postCards(entries: Entry<'posts'>[]) {
    return await Promise.all(
        entries.map(async (entry) => {
            const document = await parseMarkdown(entry.data.summary || entry.body, {
                plugins: [postMarkdownSecurity, summary()],
                autoClose: false,
            })
            const nodes = entry.data.summary
                ? document.nodes
                : (document.meta.summary ??
                  document.nodes
                      .filter((node) => Array.isArray(node) && node[0] === 'p')
                      .slice(0, 1))
            const { summary: _summary, ...data } = entry.data
            return {
                ...data,
                id: entry.id,
                url: entry.url,
                date: articleDates(entry).date,
                excerpt: { nodes, frontmatter: {}, meta: {} },
            }
        }),
    )
}
export type PostCardsPage = { items: Awaited<ReturnType<typeof postCards>>; total: number }

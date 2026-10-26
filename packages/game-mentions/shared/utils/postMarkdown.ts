import type { ComarkPlugin, Node } from 'comark'
import security from 'comark/plugins/security'

import { gameMentionRule, gameSlugPattern } from './gameMentions.js'

// Posts allow prose HTML and the game mention component.
const proseSecurity = security({
    allowedTags: [
        'game-mention',
        'p',
        'br',
        'hr',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'img',
        'strong',
        'em',
        's',
        'del',
        'code',
        'pre',
        'blockquote',
        'ul',
        'ol',
        'li',
        'input',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'div',
        'span',
        'details',
        'summary',
        'sub',
        'sup',
        'kbd',
        'mark',
    ],
    allowedProtocols: ['http', 'https', 'mailto'],
    allowDataImages: false,
})

const proseAttributes = new Set([
    'id',
    'class',
    'title',
    'lang',
    'dir',
    'role',
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'width',
    'height',
    'loading',
    'decoding',
    'start',
    'reversed',
    'type',
    'checked',
    'disabled',
    'value',
    'open',
    'colspan',
    'rowspan',
    'scope',
    'align',
    'code',
    'language',
    'filename',
    'highlights',
    'meta',
])

export const postMarkdownSecurity: ComarkPlugin = {
    ...proseSecurity,
    markdownItPlugins: [gameMentionRule],
    async post(state) {
        await proseSecurity.post?.(state)
        // Prose components consume props such as to/as/copy after URL/tag validation.
        // Accept prose attributes only; arbitrary bindings can also resolve after validation.
        const filter = (nodes: Node[]) => {
            for (const node of nodes) {
                if (typeof node === 'string') continue
                if (node[0] === 'game-mention') {
                    const slug = node[1].slug
                    node[1] = typeof slug === 'string' && gameSlugPattern.test(slug) ? { slug } : {}
                    node.splice(2, node.length - 2, typeof slug === 'string' ? slug : '')
                    continue
                }
                node[1] = Object.fromEntries(
                    Object.entries(node[1]).filter(
                        ([name, value]) =>
                            proseAttributes.has(name) ||
                            /^(aria|data)-[\w-]+$/.test(name) ||
                            (name === 'style' &&
                                ['th', 'td'].includes(node[0] ?? '') &&
                                /^text-align:(left|center|right)$/.test(String(value))) ||
                            ([':checked', ':disabled', ':open', ':reversed'].includes(name) &&
                                (value === 'true' || value === 'false')),
                    ),
                )
                filter(node.slice(2) as Node[])
            }
        }
        filter(state.tree.nodes)
    },
}

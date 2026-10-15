import type { ComarkPlugin, Node } from 'comark'
import security from 'comark/plugins/security'

// Posts support prose HTML, never executable tags or application components.
const proseSecurity = security({
    allowedTags: [
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
    async post(state) {
        await proseSecurity.post?.(state)
        // Prose components consume props such as to/as/copy after URL/tag validation.
        // Accept prose attributes only; arbitrary bindings can also resolve after validation.
        const filter = (nodes: Node[]) => {
            for (const node of nodes) {
                if (typeof node === 'string') continue
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

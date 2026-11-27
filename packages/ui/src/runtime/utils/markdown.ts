import { GFM, parser } from '@lezer/markdown'

export const markdownParser = parser.configure(GFM)

const highlightNames = new Map(
    Object.entries({
        ATXHeading1: 'md-heading',
        ATXHeading2: 'md-heading',
        ATXHeading3: 'md-heading',
        ATXHeading4: 'md-heading',
        ATXHeading5: 'md-heading',
        ATXHeading6: 'md-heading',
        SetextHeading1: 'md-heading',
        SetextHeading2: 'md-heading',
        StrongEmphasis: 'md-strong',
        Emphasis: 'md-em',
        InlineCode: 'md-code',
        FencedCode: 'md-code',
        CodeBlock: 'md-code',
        Link: 'md-link',
        Autolink: 'md-link',
        URL: 'md-link',
        Blockquote: 'md-quote',
        Comment: 'md-comment',
        CommentBlock: 'md-comment',
        HeaderMark: 'md-syntax',
        EmphasisMark: 'md-syntax',
        QuoteMark: 'md-syntax',
        ListMark: 'md-syntax',
        LinkMark: 'md-syntax',
        CodeMark: 'md-syntax',
        TaskMarker: 'md-syntax',
        HorizontalRule: 'md-syntax',
    }),
)

export const highlightMarkdown = (editor: HTMLElement) => {
    if (!globalThis.CSS?.highlights || typeof Highlight === 'undefined') return

    const textNodes: Array<{ node: Node; from: number; to: number; offsets: Array<number> }> = []
    let source = ''
    for (const node of editor.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && 'data' in node && typeof node.data === 'string') {
            const from = source.length
            const offsets: Array<number> = []
            // UI SDK adds zero-width caret anchors around tokens.
            for (let index = 0; index < node.data.length; index++) {
                const character = node.data[index]
                if (character && character !== '\u200B') {
                    offsets.push(index)
                    source += character
                }
            }
            if (offsets.length) textNodes.push({ node, from, to: source.length, offsets })
        } else if (node.nodeName === 'SPAN') source += '\uFFFC'
    }

    const ranges: Array<{ name: string; highlight: Highlight; range: Range }> = []
    markdownParser.parse(source).iterate({
        enter({ name, from, to }) {
            const group = highlightNames.get(name)
            if (!group || from === to) return

            const highlight = CSS.highlights.get(group) ?? new Highlight()
            CSS.highlights.set(group, highlight)
            highlight.priority = group === 'md-syntax' ? 2 : group === 'md-quote' ? 0 : 1
            for (const text of textNodes) {
                if (text.from >= to) break

                if (text.to <= from) continue

                const start = text.offsets[Math.max(from, text.from) - text.from]
                const end = text.offsets[Math.min(to, text.to) - text.from - 1]
                if (start === undefined || end === undefined) continue

                const range = editor.ownerDocument.createRange()
                range.setStart(text.node, start)
                range.setEnd(text.node, end + 1)
                highlight.add(range)
                ranges.push({ name: group, highlight, range })
            }
        },
    })
    return () => {
        for (const { name, highlight, range } of ranges) {
            highlight.delete(range)
            if (!highlight.size && CSS.highlights.get(name) === highlight)
                CSS.highlights.delete(name)
        }
    }
}

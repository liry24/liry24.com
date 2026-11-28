import { GFM, parser } from '@lezer/markdown'
import type { TriggerDefinition, TriggerMenuSelectDetails } from '@ui-sdk/vue/trigger-menu'

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

const plainTextSkipNodes = new Set([
    'HeaderMark',
    'EmphasisMark',
    'QuoteMark',
    'ListMark',
    'LinkMark',
    'CodeMark',
    'TaskMarker',
    'HorizontalRule',
    'LinkTitle',
    'LinkLabel',
    'CodeInfo',
    'Comment',
    'CommentBlock',
    'HTMLTag',
])

export const markdownPlainText = (source: string): string => {
    if (!source) return ''

    const skipped: Array<[number, number]> = []
    let autolinkDepth = 0
    markdownParser.parse(source).iterate({
        enter({ name, from, to }) {
            if (name === 'Autolink') {
                autolinkDepth += 1
                return
            }
            if (name === 'Escape' && to > from) {
                skipped.push([from, from + 1])
                return
            }
            if (plainTextSkipNodes.has(name) || (name === 'URL' && autolinkDepth === 0)) {
                if (to > from) skipped.push([from, to])
                return false
            }
        },
        leave({ name }) {
            if (name === 'Autolink') autolinkDepth = Math.max(0, autolinkDepth - 1)
        },
    })

    if (!skipped.length) return source.replaceAll(/\s+/g, ' ').trim()

    skipped.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    let output = ''
    let cursor = 0
    for (const [from, to] of skipped) {
        if (from > cursor) output += source.slice(cursor, from)
        if (to > cursor) cursor = to
    }
    if (cursor < source.length) output += source.slice(cursor)

    return output.replaceAll(/\s+/g, ' ').trim()
}

export const markdownHeadingLevels = ['1', '2', '3', '4', '5', '6']

const directArguments = (query: string) =>
    query.trim() ? [{ value: query.trim(), label: query.trim() }] : []

export const createMarkdownSlashCommands = ({ includeMore = false } = {}) => [
    {
        value: 'heading',
        label: 'heading',
        arguments: [
            {
                name: 'level',
                hint: '<1-6>',
                required: true,
                items: markdownHeadingLevels,
                allowCustomValue: false,
            },
        ],
    },
    { value: 'code', label: 'code', arguments: [{ name: 'lang', hint: '[language]' }] },
    { value: 'quote', label: 'quote' },
    { value: 'list', label: 'list' },
    { value: 'ordered', label: 'ordered' },
    { value: 'task', label: 'task' },
    {
        value: 'link',
        label: 'link',
        arguments: [
            { name: 'url', hint: '<URL>', required: true },
            { name: 'label', hint: '[label]' },
        ],
    },
    { value: 'divider', label: 'divider' },
    ...(includeMore ? [{ value: 'more', label: 'more' }] : []),
]

export const markdownDirectTriggers: Array<TriggerDefinition> = [
    { char: '/heading ', items: markdownHeadingLevels },
    { char: '/code ', items: directArguments },
    {
        char: '/link ',
        items: directArguments,
        spaces: true,
        maxLength: 2048,
        pattern: /[^\s]/u,
    },
]

export const applyMarkdownSlashCommand = (
    value: string,
    details: TriggerMenuSelectDetails,
    precedingLine: string,
): boolean => {
    const command = details.trigger === '/' ? value : details.trigger.slice(1).trim()
    const direct = details.trigger === '/' ? '' : value
    const blockStart = precedingLine.trim() ? '\n\n' : ''

    switch (command) {
        case 'heading':
            details.insert(`${blockStart}${'#'.repeat(Number(details.arguments.level ?? direct))} `)
            return true
        case 'code': {
            const language = (details.arguments.lang ?? direct).replaceAll(/[^\w+.-]/g, '')
            details.insert(`${blockStart}\`\`\`${language}\n\n\`\`\`\n`)
            return true
        }
        case 'quote':
            details.insert(`${blockStart}> `)
            return true
        case 'list':
            details.insert(`${blockStart}- `)
            return true
        case 'ordered':
            details.insert(`${blockStart}1. `)
            return true
        case 'task':
            details.insert(`${blockStart}- [ ] `)
            return true
        case 'link': {
            const [url = '', ...label] = direct.split(/\s+/)
            const href = (details.arguments.url ?? url).replaceAll(/[\s<>]/g, (char) =>
                encodeURIComponent(char),
            )
            const text = (details.arguments.label ?? (label.join(' ') || href)).replaceAll(
                /[\\[\]]/g,
                String.raw`\$&`,
            )
            details.insert(`[${text}](<${href}>)`)
            return true
        }
        case 'divider':
            details.insert(`${blockStart || '\n'}---\n\n`)
            return true
        case 'more':
            details.insert(`${blockStart}<!-- more -->\n\n`)
            return true
        default:
            return false
    }
}

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

    const lowerBound = (from: number) => {
        let start = 0
        let end = textNodes.length
        while (start < end) {
            const middle = Math.floor((start + end) / 2)
            const text = textNodes[middle]
            if (text && text.to <= from) start = middle + 1
            else end = middle
        }
        return start
    }

    const ranges: Array<{ name: string; highlight: Highlight; range: Range }> = []
    markdownParser.parse(source).iterate({
        enter({ name, from, to }) {
            const group = highlightNames.get(name)
            if (!group || from === to) return

            const highlight = CSS.highlights.get(group) ?? new Highlight()
            CSS.highlights.set(group, highlight)
            highlight.priority = group === 'md-syntax' ? 2 : group === 'md-quote' ? 0 : 1
            for (let index = lowerBound(from); index < textNodes.length; index++) {
                const text = textNodes[index]
                if (!text || text.from >= to) break

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

import type { ComarkPlugin, MarkdownItPlugin, Node } from 'comark'
import { parseMarkdown } from 'comark/parse'

import { gameSlugPattern } from './games.js'

interface TitlePart {
    text: string
    slug?: string
}

interface InlineStateLike {
    src: string
    pos: number
    linkLevel?: number
    push: (
        type: string,
        tag: string,
        nesting: number,
    ) => { content: string; attrSet: (name: string, value: string) => void }
}

interface InlineParserLike {
    inline: {
        ruler: {
            before: (
                beforeName: string,
                ruleName: string,
                rule: (state: InlineStateLike, silent: boolean) => boolean,
            ) => void
        }
    }
}

function registerGameMentionRule(parser: InlineParserLike) {
    parser.inline.ruler.before('autolink', 'game-mention', (state, silent) => {
        const match = readGameMention(state.src, state.pos)
        if (!match) {
            return false
        }
        if (!silent) {
            const linkLevel = state.linkLevel ?? 0
            if (gameSlugPattern.test(match.slug) && linkLevel === 0) {
                state.push('mdc_inline_component', 'game-mention', 0).attrSet('slug', match.slug)
            } else {
                state.push('text', '', 0).content = match.text
            }
        }
        state.pos += match.text.length
        return true
    })
}

export function readGameMention(input: string, position: number) {
    const opener = input[position]
    if (opener !== '<' && opener !== ':') {
        return undefined
    }
    const pattern = opener === '<' ? /<game:([^>\r\n]*)>/y : /:game\[([^\]\r\n]*)\]/y
    pattern.lastIndex = position
    const match = pattern.exec(input)
    return match?.[1] === undefined ? undefined : { text: match[0], slug: match[1] }
}

function isInlineParser(value: unknown): value is InlineParserLike {
    return (
        typeof value === 'object' &&
        value !== null &&
        'inline' in value &&
        typeof value.inline === 'object' &&
        value.inline !== null &&
        'ruler' in value.inline &&
        typeof value.inline.ruler === 'object' &&
        value.inline.ruler !== null &&
        'before' in value.inline.ruler &&
        typeof value.inline.ruler.before === 'function'
    )
}

export const gameMentionRule: MarkdownItPlugin = (parser: unknown) => {
    if (isInlineParser(parser)) {
        registerGameMentionRule(parser)
    }
}

export const gameMentionPlugin: ComarkPlugin = {
    name: 'game-mentions',
    markdownItPlugins: [gameMentionRule],
}

export function gameTitleParts(title: string): Array<TitlePart> {
    const parts: Array<TitlePart> = []
    let text = ''
    let position = 0
    const flush = () => {
        if (text) {
            parts.push({ text })
        }
        text = ''
    }
    while (position < title.length) {
        if (title.charCodeAt(position) === 92 && position + 1 < title.length) {
            text += title.slice(position, position + 2)
            position += 2
            continue
        }
        if (title[position] === '`') {
            const runMatch = /^`+/.exec(title.slice(position))
            const run = runMatch?.[0] ?? '`'
            const closing = /`+/g
            closing.lastIndex = position + run.length
            let match = closing.exec(title)
            while (match && match[0].length !== run.length) {
                match = closing.exec(title)
            }
            const end = match ? match.index + run.length : position + run.length
            text += title.slice(position, end)
            position = end
            continue
        }
        const match = readGameMention(title, position)
        if (match && gameSlugPattern.test(match.slug)) {
            flush()
            parts.push(match)
            position += match.text.length
        } else {
            text += title[position++]
        }
    }
    flush()
    return parts
}

export async function postGameSlugs(title: string, content: string): Promise<Array<string>> {
    const slugs = gameTitleParts(title).flatMap((part) => (part.slug ? [part.slug] : []))
    const document = await parseMarkdown(content, {
        plugins: [gameMentionPlugin],
        autoClose: false,
    })
    const visit = (nodes: Array<Node>) => {
        for (const node of nodes) {
            if (typeof node === 'string' || node[0] === null) {
                continue
            }
            const [tag, attrs, ...children] = node
            if (
                tag === 'game-mention' &&
                typeof attrs.slug === 'string' &&
                gameSlugPattern.test(attrs.slug)
            ) {
                slugs.push(attrs.slug)
            }
            if (!['a', 'code', 'pre'].includes(tag)) {
                visit(children)
            }
        }
    }
    visit(document.nodes)
    return [...new Set(slugs)]
}

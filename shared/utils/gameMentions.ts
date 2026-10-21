import type { ComarkPlugin, MarkdownItPlugin, Node } from 'comark'
import { parseMarkdown } from 'comark/parse'

import type { TitlePart } from '../types/gameMentions'
import { gameSlugPattern } from './games.js'
export const gameMentionRule: MarkdownItPlugin = (parser) => {
    parser.inline.ruler.before('autolink', 'game-mention', (state, silent) => {
        if (state.src[state.pos] !== '<') return false
        const match = /^<game:([^>\n]*)>/.exec(state.src.slice(state.pos))
        if (!match) return false
        if (!silent) {
            if (gameSlugPattern.test(match[1]!) && 'linkLevel' in state && state.linkLevel === 0)
                state.push('mdc_inline_component', 'game-mention', 0).attrSet('slug', match[1]!)
            else state.push('text', '', 0).content = match[0]
        }
        state.pos += match[0].length
        return true
    })
}
export const gameMentionPlugin: ComarkPlugin = {
    name: 'game-mentions',
    markdownItPlugins: [gameMentionRule],
}

export function gameTitleParts(title: string): TitlePart[] {
    const parts: TitlePart[] = []
    let text = '',
        position = 0
    const flush = () => {
        if (text) parts.push({ text })
        text = ''
    }
    while (position < title.length) {
        if (title.charCodeAt(position) === 92 && position + 1 < title.length) {
            text += title.slice(position, position + 2)
            position += 2
            continue
        }
        if (title[position] === '`') {
            const run = /^`+/.exec(title.slice(position))![0]
            const closing = /`+/g
            closing.lastIndex = position + run.length
            let match = closing.exec(title)
            while (match && match[0].length !== run.length) match = closing.exec(title)
            const end = match ? match.index + run.length : position + run.length
            text += title.slice(position, end)
            position = end
            continue
        }
        const match = /^<game:([^>]+)>/.exec(title.slice(position))
        if (match && gameSlugPattern.test(match[1]!)) {
            flush()
            parts.push({ text: match[0], slug: match[1] })
            position += match[0].length
        } else text += title[position++]
    }
    flush()
    return parts
}
export async function postGameSlugs(title: string, content: string): Promise<string[]> {
    const slugs = gameTitleParts(title).flatMap((part) => (part.slug ? [part.slug] : []))
    const document = await parseMarkdown(content, {
        plugins: [gameMentionPlugin],
        autoClose: false,
    })
    const visit = (nodes: Node[]) => {
        for (const node of nodes) {
            if (typeof node === 'string') continue
            if (
                node[0] === 'game-mention' &&
                typeof node[1].slug === 'string' &&
                gameSlugPattern.test(node[1].slug)
            )
                slugs.push(node[1].slug)
            if (!['code', 'pre'].includes(node[0] ?? '')) visit(node.slice(2) as Node[])
        }
    }
    visit(document.nodes)
    return [...new Set(slugs)]
}
export function gameMentionQuery(value: string, caret: number) {
    const match = /<game:([a-zA-Z0-9 -]*)$/.exec(value.slice(0, caret))
    if (!match || (match.index > 0 && value.charCodeAt(match.index - 1) === 92)) return null
    return { start: match.index, end: caret, query: match[1]! }
}

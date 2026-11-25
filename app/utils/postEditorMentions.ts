import { markdownParser } from '@liry24/ui/markdown'

const mentionParser = markdownParser.configure({
    defineNodes: ['GameMention'],
    parseInline: [
        {
            name: 'GameMention',
            before: 'HTMLTag',
            parse(context, next, position) {
                if (next !== 60 && next !== 58) {
                    return -1
                }
                const match = readGameMention(context.text, position - context.offset)
                return match && gameSlugPattern.test(match.slug)
                    ? context.addElement(
                          context.elt('GameMention', position, position + match.text.length),
                      )
                    : -1
            },
        },
    ],
})

export function postEditorMentionParts(source: string, multiline: boolean) {
    if (!multiline) {
        return gameTitleParts(source)
    }

    const parts: ReturnType<typeof gameTitleParts> = []
    const frontmatter = /^---\r?\n[\s\S]+?\r?\n---(?=\r?\n|$)/.exec(source)?.[0] ?? ''
    let offset = 0
    mentionParser.parse(source.slice(frontmatter.length)).iterate({
        enter({ name, from, to }) {
            if (['Link', 'Image', 'LinkReference', 'Autolink'].includes(name)) {
                return false
            }
            if (name !== 'GameMention') {
                return
            }
            const start = from + frontmatter.length
            const match = readGameMention(source, start)
            if (match) {
                if (start > offset) {
                    parts.push({ text: source.slice(offset, start) })
                }
                parts.push(match)
                offset = to + frontmatter.length
            }
        },
    })
    if (offset < source.length) {
        parts.push({ text: source.slice(offset) })
    }
    return parts
}

export const formatGameMention = (slug: string) => `:game[${slug}]`

export function postEditorTokens(
    source: string,
    multiline: boolean,
    games: ReadonlyMap<string, GameSearchResult>,
) {
    return postEditorMentionParts(source, multiline).map(({ text, slug }) =>
        slug ? { type: 'game', value: slug, label: games.get(slug)?.name ?? slug } : text,
    )
}

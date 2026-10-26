import { gameTitleParts, postGameSlugs, gameMentionQuery } from '@liry24/game-mentions'
import { postMarkdownSecurity } from '@liry24/game-mentions'
import { parseMarkdown } from 'comark/parse'
import { expect, test } from 'vitest'

test('the inline rule keeps exact IGDB slugs and excludes code, escapes, unsafe attributes and linked labels', async () => {
    const source =
        'Before <game:valorant> and <game:exact--igdb-slug>\n\n`<game:inline-code>`\n\n```html\n<game:block-code>\n```\n\n\\<game:escaped> [<game:linked>](https://example.invalid) <game:bad_slug>'
    expect(await postGameSlugs('Title <game:valorant>', source)).toEqual([
        'valorant',
        'exact--igdb-slug',
    ])
    const document = await parseMarkdown(
        source + '\n\n:game-mention{slug="valorant" :as="script" onclick="bad()"}',
        { plugins: [postMarkdownSecurity], autoClose: false },
    )
    const nodes = JSON.stringify(document.nodes)
    expect(nodes).toContain('["game-mention",{"slug":"valorant"},"valorant"]')
    expect(nodes).not.toContain('onclick')
    expect(nodes).not.toContain(':as')
    expect(nodes).toContain('<game:bad_slug>')
})
test('titles support only literal text and mentions; code and escaped tokens remain literal', () => {
    const title = '**Literal** <game:valorant> `<game:code>` \\<game:escaped>'
    const parts = gameTitleParts(title)
    expect(parts.filter((part) => part.slug)).toEqual([
        { text: '<game:valorant>', slug: 'valorant' },
    ])
    expect(parts.map((part) => part.text).join('')).toBe(title)
    expect(gameMentionQuery('hi <game:valo trailing', 13)).toEqual({
        start: 3,
        end: 13,
        query: 'valo',
    })
    expect(gameMentionQuery('hi <game:valorant>', 18)).toBeNull()
    expect(gameMentionQuery('\\<game:valo', 11)).toBeNull()
})

test('titles use matching backtick runs and consume unmatched opening runs together', async () => {
    for (const title of [
        '`` no close `<game:code>` <game:outside>',
        '``literal ` <game:code>`` <game:outside>',
        '`<game:code>`` still code ` <game:outside>',
    ]) {
        expect(gameTitleParts(title).flatMap((part) => (part.slug ? [part.slug] : []))).toEqual([
            'outside',
        ])
        expect(await postGameSlugs('', title)).toEqual(['outside'])
        expect(
            gameTitleParts(title)
                .map((part) => part.text)
                .join(''),
        ).toBe(title)
    }
})

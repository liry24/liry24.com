import { expect, test } from 'vitest'

import { postEditorMentionParts } from '../../app/utils/postEditorMentions.js'

test('the editor restores chips while keeping Markdown examples and links as source text', () => {
    const markdown = [
        'Actual <game:legacy> and :game[current].',
        '[<game:linked> and :game[linked]](https://example.invalid)',
        String.raw`\<game:escaped> and \:game[escaped]`,
        '`<game:literal>` and `:game[literal]`',
        '> ```md\n> <game:code>\n> ```',
        '| Game |\n| --- |\n| :game[in-table] |',
    ].join('\n\n')
    const parts = postEditorMentionParts(markdown, true)
    expect(parts.flatMap(({ slug }) => (slug ? [slug] : []))).toEqual([
        'legacy',
        'current',
        'in-table',
    ])
    expect(parts.map(({ text }) => text).join('')).toBe(markdown)
})

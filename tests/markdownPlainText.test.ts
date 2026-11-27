import { expect, test } from 'vitest'

import { markdownPlainText } from '../packages/ui/src/runtime/utils/markdown'

test('markdownPlainText strips Markdown syntax while preserving readable text', () => {
    expect(markdownPlainText('')).toBe('')
    expect(
        markdownPlainText(
            '# Title\n\nA **bold** and _italic_ line with `code` and a [link](https://example.com).',
        ),
    ).toBe('Title A bold and italic line with code and a link.')
    expect(markdownPlainText('- First item\n- [x] Second task\n\n> Quoted note')).toBe(
        'First item Second task Quoted note',
    )
    expect(
        markdownPlainText('See ![alt text](https://example.com/a.png) and <https://liry24.com>.'),
    ).toBe('See alt text and https://liry24.com.')
    expect(markdownPlainText(String.raw`Escaped \*stars\*<!-- hidden -->`)).toBe('Escaped *stars*')
})

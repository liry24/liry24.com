import { parseMarkdown } from 'comark/parse'
import summary from 'comark/plugins/summary'
import { expect, test } from 'vitest'

import { postMarkdownSecurity } from '../../shared/utils/postMarkdown'
import { content, assertSafe } from '../helpers/postMarkdown'

test('post preview and card summaries share the Markdown security policy', async () => {
    const preview = await parseMarkdown(content, { plugins: [postMarkdownSecurity] })
    const parsed = await parseMarkdown(content, { plugins: [postMarkdownSecurity, summary()] })
    assertSafe(preview.nodes)
    assertSafe(parsed.meta.summary!)
    expect(JSON.stringify(preview.nodes)).toContain('Code example remains text')
    expect(JSON.stringify(parsed.meta.summary)).not.toContain('Full body')
})

import { expect, test, vi } from 'vitest'

import { generateEntrySlug, suggestEntrySlug } from '../server/utils/entrySlug'

const { generateText } = vi.hoisted(() => ({
    generateText: vi.fn<() => Promise<{ text: string }>>(),
}))

vi.mock('ai', () => ({ generateText }))
vi.mock('../server/utils/editorialModel', () => ({
    editorialModelId: 'gemini-4-hydrogen',
    readEditorialApiKey: () => 'synthetic-google-key',
}))

test('prefers a valid Gemini slug', async () => {
    generateText.mockResolvedValueOnce({ text: ' mountain_view\n' })
    await expect(generateEntrySlug('山の眺め')).resolves.toBe('mountain_view')
})

test('falls back to snake case when Gemini is unavailable', async () => {
    generateText.mockRejectedValueOnce(new Error('Synthetic provider failure'))
    await expect(generateEntrySlug('Café OpenSource')).resolves.toBe('cafe_open_source')
})

test('accepts a kebab-case slug for posts', async () => {
    generateText.mockResolvedValueOnce({ text: 'mountain-view\n' })
    await expect(suggestEntrySlug('山の眺め', 48, 'kebab')).resolves.toBe('mountain-view')
})

test.each(['a'.repeat(49), 'UPPER-CASE', 'double--hyphen', 'snake_case', '`valid-slug`'])(
    'rejects invalid post slug suggestions such as %s',
    async (text) => {
        generateText.mockResolvedValueOnce({ text })
        await expect(suggestEntrySlug('Example', 48, 'kebab')).resolves.toBeUndefined()
    },
)

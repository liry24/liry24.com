import { customAlphabet } from 'nanoid'

const slugFormats = {
    snake: { pattern: /^[a-z0-9]+(?:_[a-z0-9]+)*$/u, instruction: 'snake_case with underscores' },
    kebab: { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, instruction: 'kebab-case with hyphens' },
}
const randomSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12)

export async function generateEntrySlug(label: string): Promise<string> {
    return (await suggestEntrySlug(label, 80)) ?? fallbackEntrySlug(label)
}

export async function suggestEntrySlug(
    label: string,
    maxLength: number,
    style: keyof typeof slugFormats = 'snake',
): Promise<string | undefined> {
    const apiKey = readEditorialApiKey()
    const { pattern, instruction } = slugFormats[style]
    if (apiKey && label.trim()) {
        try {
            const [{ createGoogleGenerativeAI }, { generateText }] = await Promise.all([
                import('@ai-sdk/google'),
                import('ai'),
            ])
            const google = createGoogleGenerativeAI({ apiKey })
            const { text } = await generateText({
                model: google(editorialModelId),
                system: `Turn the supplied label into a short, recognizable English URL slug. Translate or romanize it if needed. Keep only the most distinctive words. Return a single slug in ${instruction}, using lowercase ASCII letters and digits, at most ${maxLength} characters.`,
                prompt: label.slice(0, 500),
                maxOutputTokens: 128,
                maxRetries: 0,
                abortSignal: AbortSignal.timeout(5000),
                providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
            })
            const slug = text.trim()
            if (slug.length <= maxLength && pattern.test(slug)) return slug
        } catch {
            // Callers can continue with a local slug after a provider error or timeout.
        }
    }
}

export function fallbackEntrySlug(
    label: string,
    maxLength = 80,
    style: keyof typeof slugFormats = 'snake',
): string {
    const slug = label
        .normalize('NFKD')
        .replaceAll(/\p{M}/gu, '')
        .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, '$1_$2')
        .replaceAll(/([a-z0-9])([A-Z])/gu, '$1_$2')
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '_')
        .replaceAll(/^_|_$/gu, '')
        .slice(0, maxLength)
        .replace(/_$/u, '')
    if (!slug) return randomSlug()
    return style === 'kebab' ? slug.replaceAll('_', '-') : slug
}

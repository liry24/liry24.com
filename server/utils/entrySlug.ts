import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { customAlphabet } from 'nanoid'

const slugPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/u
const randomSlug = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12)

export async function generateEntrySlug(label: string): Promise<string> {
    const apiKey = readEditorialApiKey()
    if (apiKey && label.trim()) {
        try {
            const google = createGoogleGenerativeAI({ apiKey })
            const { text } = await generateText({
                model: google(editorialModelId),
                system: 'Turn the supplied label into a short, recognizable English URL slug. Translate or romanize it if needed. Return only lowercase ASCII words and digits separated by underscores, up to 80 characters.',
                prompt: label.slice(0, 500),
                maxOutputTokens: 128,
                maxRetries: 0,
                abortSignal: AbortSignal.timeout(5000),
                providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
            })
            const slug = text.trim()
            if (slug.length <= 80 && slugPattern.test(slug)) return slug
        } catch {
            // A provider error or timeout should not prevent saving a draft.
        }
    }

    const slug = label
        .normalize('NFKD')
        .replaceAll(/\p{M}/gu, '')
        .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, '$1_$2')
        .replaceAll(/([a-z0-9])([A-Z])/gu, '$1_$2')
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, '_')
        .replaceAll(/^_|_$/gu, '')
        .slice(0, 80)
        .replace(/_$/u, '')
    return slug || randomSlug()
}

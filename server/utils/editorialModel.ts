export const editorialModelId = 'gemini-4-hydrogen'

export function readEditorialApiKey(): string | undefined {
    if (readProcessEnv('LIRY24_TEST_LOCAL') === 'true' || readProcessEnv('APP_ENV') === 'test')
        return undefined

    try {
        const key = readSecretValue(useServerEnv().GOOGLE_GENERATIVE_AI_API_KEY)
        if (key) return key
    } catch {
        // Fallback when running outside the generated Nitro/Vite env bridge.
    }
    return readProcessEnv('GOOGLE_GENERATIVE_AI_API_KEY') || undefined
}

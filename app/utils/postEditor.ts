export interface PostEditorDraft {
    data: Record<string, unknown>
    slug: string
    manualSlug: boolean
    manualExcerpt: boolean
    version: number | null
}

// The editor accepts proposal functions supplied by the published Site Admin integration.
// Keep model transport, prompts and response parsing in Site Admin.
export interface PostEditorAI {
    generate: (input: {
        data: Record<string, unknown>
        fields: ('slug' | 'excerpt')[]
        slug?: string
    }) => Promise<{ slug?: string; excerpt?: string }>
    proofread: (input: { data: Record<string, unknown> }) => Promise<{ content: string }>
}

export const postEditorAIFields = (manualSlug: boolean, manualExcerpt: boolean) =>
    [...(!manualSlug ? ['slug'] : []), ...(!manualExcerpt ? ['excerpt'] : [])] as (
        | 'slug'
        | 'excerpt'
    )[]

export const postEditorSnapshot = (data: Record<string, unknown>) =>
    JSON.parse(JSON.stringify(data)) as Record<string, unknown>

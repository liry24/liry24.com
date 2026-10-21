import { createSlugGenerator } from '@litijs/ai'
import { createProofreader } from '@litijs/blog'

export const postAiActions = {
    publication: createSlugGenerator(),
    proofread: createProofreader({
        protect: (content) => content.match(/<game:[a-z0-9][a-z0-9-]*>/g) ?? [],
    }),
}

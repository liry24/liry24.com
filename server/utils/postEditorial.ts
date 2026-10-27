import { validateProofreading } from '@litijs/blog'
import { ModelError } from '@litijs/model'

export async function validatePostProofreading(original: string, proposal: string) {
    if (
        !(await validateProofreading(original, proposal, {
            protect: (body) => Array.from(body.matchAll(/<game:[^>\r\n]+>/gu), (match) => match[0]),
        }))
    )
        throw new ModelError(
            'LITI_INVALID_INPUT',
            'Proofreading changed protected Markdown or game tags.',
        )
    return { body: proposal }
}

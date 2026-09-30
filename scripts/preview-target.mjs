import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const workerName = 'liry24-com'
export const repository = 'Liry24/liry24.com'
export const workersSubdomain = 'liry'

export function previewTarget(branch) {
    assert(typeof branch === 'string' && branch.length > 0, 'A branch is required')
    assert(
        branch !== 'main' && !branch.startsWith('refs/'),
        'Expected a non-production branch name',
    )
    const slug =
        branch
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 18) || 'branch'
    const hash = createHash('sha256').update(branch).digest('hex').slice(0, 12)
    const name = `p-${slug}-${hash}`
    return {
        name,
        resourceName: `${workerName}-${name}`,
        url: `https://${name}-${workerName}.${workersSubdomain}.workers.dev`,
    }
}

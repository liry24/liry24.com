import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const workerName = 'liry24-com'
export const repository = 'Liry24/liry24.com'
export const workersSubdomain = 'liry'

export function previewBindings({ siteURL, databaseId, resourceName }) {
    assert(
        siteURL && databaseId && resourceName,
        'Preview URL, D1 ID and resource name are required',
    )
    assert(resourceName.startsWith(`${workerName}-p-`), 'Not a Preview resource')
    assert(databaseId !== '227d818f-cd40-4fca-9710-b57273be94ca', 'Not a Preview database')
    assert(
        new URL(siteURL).hostname ===
            `${resourceName.slice(workerName.length + 1)}-${workerName}.${workersSubdomain}.workers.dev`,
        'Unexpected Preview origin',
    )
    return {
        vars: {
            APP_ENV: 'preview',
            NUXT_PUBLIC_PREVIEW: 'true',
            NUXT_PUBLIC_SITE_URL: siteURL,
            NUXT_PUBLIC_IMAGES_DOMAIN: siteURL,
            R2_DOMAIN: siteURL,
        },
        d1_databases: [{ binding: 'DB', database_name: resourceName, database_id: databaseId }],
        r2_buckets: [{ binding: 'R2', bucket_name: resourceName }],
    }
}

function previewSlug(branch) {
    return (
        branch
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 18)
            .replace(/^-+|-+$/g, '') || 'branch'
    )
}

export function previewTarget(branch) {
    assert(typeof branch === 'string' && branch.length > 0, 'A branch is required')
    assert(
        branch !== 'main' && !branch.startsWith('refs/'),
        'Expected a non-production branch name',
    )
    const hash = createHash('sha256').update(branch).digest('hex').slice(0, 12)
    const name = `p-${previewSlug(branch)}-${hash}`
    // workers.dev collapses consecutive hyphens, so the routed host would not match this name.
    assert(!name.includes('--'), 'Preview names cannot contain consecutive hyphens')
    return {
        name,
        resourceName: `${workerName}-${name}`,
        url: `https://${name}-${workerName}.${workersSubdomain}.workers.dev`,
    }
}

// Names generated before the trailing-hyphen trim. Redeploys must remove them or they keep the corrected host.
export function retiredPreviewTarget(branch) {
    const current = previewTarget(branch)
    const legacySlug =
        branch
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 18) || 'branch'
    const hash = createHash('sha256').update(branch).digest('hex').slice(0, 12)
    const name = `p-${legacySlug}-${hash}`
    if (name === current.name) return null
    return {
        name,
        resourceName: `${workerName}-${name}`,
        url: `https://${name}-${workerName}.${workersSubdomain}.workers.dev`,
    }
}

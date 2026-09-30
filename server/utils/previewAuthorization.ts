const repository = 'Liry24/liry24.com'

const github = async (path: string) => {
    const token = process.env.PREVIEW_GITHUB_TOKEN
    if (!token) throw new Error('Preview GitHub permission token is not configured')
    const response = await fetch(`https://api.github.com${path}`, {
        headers: {
            authorization: `Bearer ${token}`,
            accept: 'application/vnd.github+json',
            'user-agent': 'liry24-preview',
            'x-github-api-version': '2026-03-10',
        },
        signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('GitHub permission lookup failed')
    const data = await response.json()
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Invalid GitHub response')
    return data as Record<string, unknown>
}

export async function isPreviewGitHubAdmin(profile?: Record<string, unknown>) {
    const id = String(profile?.id ?? '')
    const login = profile?.login
    if (
        !/^\d+$/.test(id) ||
        typeof login !== 'string' ||
        !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)
    )
        return false
    try {
        const result = await github(
            `/repos/${repository}/collaborators/${encodeURIComponent(login)}/permission`,
        )
        return (
            result.permission === 'admin' &&
            result.user !== null &&
            typeof result.user === 'object' &&
            String(Reflect.get(result.user, 'id')) === id
        )
    } catch {
        return false
    }
}

export async function isPreviewGitHubAccountAdmin(accountId: string) {
    if (!/^\d+$/.test(accountId)) return false
    try {
        const profile = await github(`/user/${accountId}`)
        return String(profile.id) === accountId && (await isPreviewGitHubAdmin(profile))
    } catch {
        return false
    }
}

export async function validatePreviewIdentity({
    source,
}: {
    source: { method: string; oauth?: { providerId: string; profile?: Record<string, unknown> } }
}) {
    if (process.env.APP_ENV !== 'preview') return
    if (
        source.method === 'oauth' &&
        source.oauth?.providerId === 'github' &&
        (await isPreviewGitHubAdmin(source.oauth.profile))
    )
        return
    return {
        error: 'preview_access_denied',
        errorDescription: 'このPreviewにはリポジトリの管理権限が必要です。',
    }
}

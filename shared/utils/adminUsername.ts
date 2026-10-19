export function adminUserPath(user: { id: string; username?: string | null }) {
    return `/admin/@${encodeURIComponent(user.username || `~${user.id}`)}`
}

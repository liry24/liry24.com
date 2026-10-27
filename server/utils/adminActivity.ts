import type { AdminActivityInput } from '../../shared/types/adminActivity.js'

export async function recordAdminActivity(input: AdminActivityInput) {
    try {
        // Lazy imports keep auth schema generation independent of the previous generated schema.
        const { db } = await import('vite-hub/database/drizzle')
        const { adminEvent } = await import('../database/auth-schema.js')
        await db.insert(adminEvent).values({
            id: crypto.randomUUID(),
            actorId: input.actorId,
            action: input.action,
            targetId: input.targetId,
            model: input.model ?? null,
            label: input.label?.slice(0, 300) || null,
            createdAt: new Date(),
        })
    } catch {
        // Activity must never turn a committed operation into a retryable failure.
        console.error('[admin-activity] Failed to save activity', { action: input.action })
    }
}

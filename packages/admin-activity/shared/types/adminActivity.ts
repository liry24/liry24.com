import type { adminActivityLabels } from '../utils/adminActivity.js'
export type AdminActivityAction = keyof typeof adminActivityLabels

export interface AdminActivityInput {
    actorId: string
    action: AdminActivityAction
    targetId: string
    model?: string
    label?: string
}

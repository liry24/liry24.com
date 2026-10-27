import type { ModelCommit } from '@litijs/model'

import type { AdminActivityAction } from '../../shared/types/adminActivity.js'
import { recordAdminActivity } from './adminActivity.js'

const actions: Record<ModelCommit['action'], AdminActivityAction> = {
    create: 'content.create',
    update: 'content.update',
    remove: 'content.delete',
    restore: 'content.restore',
    publish: 'content.publish',
    unpublish: 'content.unpublish',
    schedule: 'content.schedule',
    cancelSchedule: 'content.cancelSchedule',
    reorder: 'content.sort',
}

export async function modelActivity(event: ModelCommit) {
    await recordAdminActivity({
        actorId: event.actor.id,
        action: actions[event.action],
        targetId: event.id,
        model: event.model,
        label: event.label ?? event.id,
    })
}

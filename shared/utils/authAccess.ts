import { createAccessControl } from 'better-auth/plugins'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

const modelActions = [
    'readDraft',
    'save',
    'create',
    'update',
    'remove',
    'restore',
    'publish',
    'schedule',
    'reorder',
] as const
export const modelAccess = {
    'liti:model:posts': modelActions,
    'liti:model:works': modelActions,
    'liti:model:arts': modelActions,
    'liti:model:careers': modelActions,
    'liti:model:skills': modelActions,
    'liti:model:games': modelActions,
    'liti:model:gameStats': modelActions,
    'liti:model:ranks': modelActions,
    'liti:model:socials': modelActions,
}

export const adminAccess = createAccessControl({
    ...defaultStatements,
    ...modelAccess,
    adminPanel: ['access', 'compose'],
    activity: ['readOwn', 'readAny'],
} as const)

export const adminRoles = {
    admin: adminAccess.newRole({
        ...adminAc.statements,
        ...modelAccess,
        adminPanel: ['access', 'compose'],
        activity: ['readOwn', 'readAny'],
    }),
    user: adminAccess.newRole({
        ...userAc.statements,
        activity: ['readOwn'],
    }),
}

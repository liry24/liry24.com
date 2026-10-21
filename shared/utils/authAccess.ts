import { createAccessControl } from 'better-auth/plugins'
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access'

export const adminAccess = createAccessControl({
    ...defaultStatements,
    adminPanel: ['access', 'compose'],
    activity: ['readOwn', 'readAny'],
} as const)

export const adminRoles = {
    admin: adminAccess.newRole({
        ...adminAc.statements,
        adminPanel: ['access', 'compose'],
        activity: ['readOwn', 'readAny'],
    }),
    user: adminAccess.newRole({
        ...userAc.statements,
        activity: ['readOwn'],
    }),
}

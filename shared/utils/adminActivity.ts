export const adminActivityLabels = {
    'content.create': 'Created',
    'content.update': 'Updated',
    'content.delete': 'Deleted',
    'content.publish': 'Published',
    'content.unpublish': 'Unpublished',
    'content.schedule': 'Scheduled publication',
    'content.cancelSchedule': 'Cancelled publication',
    'content.restore': 'Restored a revision',
    'content.sort': 'Changed order',
    'account.create': 'Registered',
    'account.update': 'Updated profile',
    'session.create': 'Signed in',
    'session.logout': 'Signed out',
    'session.revoke': 'Revoked a session',
    'provider.link': 'Linked account',
    'provider.unlink': 'Unlinked account',
    'passkey.create': 'Added passkey',
    'passkey.update': 'Renamed passkey',
    'passkey.delete': 'Removed passkey',
} as const

export type AdminActivityAction = keyof typeof adminActivityLabels

export interface AdminActivityInput {
    actorId: string
    action: AdminActivityAction
    targetId: string
    model?: string
    label?: string
}

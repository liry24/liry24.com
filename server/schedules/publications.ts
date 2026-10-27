import { defineSchedule } from 'vite-hub/schedule'

import runtime from '#liti/runtime'

export default defineSchedule({
    cron: '* * * * *',
    handler: async ({ scheduledAt }) => {
        const result = await runtime.content.publishDue(
            { actor: { id: 'liry24:publish-due', role: 'system' } },
            scheduledAt,
        )
        if (result.failed.length)
            throw new AggregateError(
                result.failed.map((entry) => entry.error),
                'Scheduled publication failed',
            )
    },
})

import { defineSchedule } from 'vite-hub/schedule'

import content from '#server/content'

export default defineSchedule({
    cron: '* * * * *',
    manual: true,
    handler: async () => await content.publishDue(),
})

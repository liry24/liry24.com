import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
    envDir: false,
    resolve: {
        dedupe: ['vue', '@tanstack/vue-form'],
        alias: { '~~': fileURLToPath(new URL('.', import.meta.url)) },
    },
    test: { server: { deps: { inline: [/site-admin/] } }, include: ['tests/**/*.test.ts'] },
})

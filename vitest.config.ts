import { fileURLToPath } from 'node:url'

import { createSiteAdminDependencyPlugin } from '@liria24/site-admin/dependency-aliases'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    envDir: false,
    plugins: [createSiteAdminDependencyPlugin()],
    resolve: { alias: { '~~': fileURLToPath(new URL('.', import.meta.url)) } },
    test: { include: ['tests/**/*.test.ts'] },
})

import { createSiteAdminDependencyPlugin } from '@liria24/site-admin/dependency-aliases'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    envDir: false,
    plugins: [createSiteAdminDependencyPlugin()],
    test: { include: ['tests/**/*.test.ts'] },
})

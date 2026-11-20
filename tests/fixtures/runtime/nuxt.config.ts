import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'

const root = fileURLToPath(new URL('../../../', import.meta.url))
    .split(sep)
    .join('/')
export default defineNuxtConfig({
    extends: [
        '@liry24/admin-activity/nuxt',
        '@liry24/admin-composer/nuxt',
        '@liry24/game-mentions/nuxt',
    ],
    compatibilityDate: '2026-10-13',
    devtools: { enabled: false },
    pages: false,
    alias: { '~~': root, '~': root + 'app' },
    imports: {
        dirs: [
            root + 'app/composables',
            root + 'app/utils',
            root + 'shared/utils',
            root + 'shared/types',
        ],
        presets: [
            {
                from: root + 'tests/fixtures/runtime/boundaries.ts',
                imports: ['useUserSession', 'useAuthClient', 'useI18n'],
            },
        ],
    },
})

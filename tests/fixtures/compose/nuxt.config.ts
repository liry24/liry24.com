import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'
const path = (value: string) =>
    fileURLToPath(new URL(value, import.meta.url))
        .split(sep)
        .join('/')
export default defineNuxtConfig({
    compatibilityDate: '2026-10-13',
    ssr: false,
    devtools: { enabled: false },
    pages: false,
    nitro: {
        preset: 'node-server',
        imports: {
            dirs: [
                path('../../../server/utils'),
                path('../../../shared/utils'),
                path('../../../shared/types'),
            ],
            imports: [{ name: 'queryIgdb', from: path('./games.ts'), priority: 10 }],
        },
        alias: {
            'liti/nuxt/server': path('./sdk.ts'),
            'void/ai': path('./evaluator.ts'),
        },
    },
})

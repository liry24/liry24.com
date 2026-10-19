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
        alias: {
            '@liria24/site-admin/server': path('./sdk.ts'),
            '@liria24/site-admin/internal/runtime/nitro2': path('./sdk.ts'),
            'void/ai': path('./evaluator.ts'),
        },
    },
})

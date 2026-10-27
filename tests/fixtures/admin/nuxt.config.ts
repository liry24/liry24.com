import { readFileSync, readdirSync } from 'node:fs'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'

const path = (value: string) =>
    fileURLToPath(new URL(value, import.meta.url))
        .split(sep)
        .join('/')
const migrations = readdirSync(path('../../../server/databases/migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path(`../../../server/databases/migrations/${file}`), 'utf8'))
export default defineNuxtConfig({
    compatibilityDate: '2026-10-13',
    ssr: false,
    pages: false,
    devtools: { enabled: false },
    nitro: {
        preset: 'node-server',
        imports: {
            dirs: [
                path('../../../server/utils'),
                path('../../../shared/utils'),
                path('../../../shared/types'),
            ],
        },
        alias: {
            'vite-hub/database/drizzle': path('./database.ts'),
        },
        virtual: { '#fixture/migrations': `export default ${JSON.stringify(migrations)}` },
    },
})

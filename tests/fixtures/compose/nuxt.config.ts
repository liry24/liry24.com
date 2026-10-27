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
    devtools: { enabled: false },
    pages: false,
    nitro: {
        preset: 'node-server',
        handlers: [
            {
                route: '/api/admin/posts/proofread',
                method: 'post',
                handler: path('../../../server/api/admin/posts/proofread.post.ts'),
            },
        ],
        imports: {
            dirs: [
                path('../../../server/utils'),
                path('../../../shared/utils'),
                path('../../../shared/types'),
            ],
            imports: [{ name: 'queryIgdb', from: path('./games.ts'), priority: 10 }],
        },
        alias: {
            '../utils/postEditorialModel.ts': path('./editorial-model.ts'),
            '#liti/runtime': path('./runtime.ts'),
            'vite-hub/database/drizzle': path('../admin/database.ts'),
            'vite-hub/workspace': path('./workspace.ts'),
            'vite-hub/auth/server': path('./auth-origin.ts'),
        },
        virtual: { '#fixture/migrations': `export default ${JSON.stringify(migrations)}` },
    },
})

import { readFileSync, readdirSync } from 'node:fs'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'

const path = (value: string) =>
    fileURLToPath(new URL(value, import.meta.url))
        .split(sep)
        .join('/')
const migrations = readdirSync(path('../../../db/migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(path(`../../../db/migrations/${file}`), 'utf8'))
export default defineNuxtConfig({
    compatibilityDate: '2026-10-13',
    ssr: false,
    pages: false,
    devtools: { enabled: false },
    alias: { '~~': path('../../../') },
    nitro: {
        preset: 'node-server',
        imports: {
            dirs: [
                path('../../../server/utils'),
                path('../../../shared/utils'),
                path('../../../shared/types'),
                ...['admin-activity', 'admin-composer', 'game-mentions'].flatMap((name) => [
                    path(`../../../packages/${name}/server/utils`),
                    path(`../../../packages/${name}/shared/utils`),
                    path(`../../../packages/${name}/shared/types`),
                ]),
            ],
        },
        alias: {
            'void/db': path('./database.ts'),
            'liti/nuxt/server': path('../compose/sdk.ts'),
        },
        virtual: { '#fixture/migrations': `export default ${JSON.stringify(migrations)}` },
    },
})

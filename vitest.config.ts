import { fileURLToPath } from 'node:url'

import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig({
    envDir: false,
    test: {
        projects: [
            {
                resolve: { dedupe: ['vue', '@tanstack/vue-form'], alias: { '~~': root } },
                test: {
                    name: 'node',
                    server: { deps: { inline: [/liti/] } },
                    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
                    exclude: ['tests/nuxt/**', 'tests/fixtures/**', 'packages/*/tests/nuxt/**'],
                },
            },
            await defineVitestProject({
                root,
                test: {
                    name: 'nuxt',
                    // Vitest 5's disk cache loses the drive on Nuxt's virtual app entry on Windows.
                    fsModuleCache: process.platform !== 'win32',
                    include: ['tests/nuxt/**/*.test.ts', 'packages/*/tests/nuxt/**/*.test.ts'],
                    environment: 'nuxt',
                    environmentOptions: {
                        nuxt: {
                            rootDir: fileURLToPath(
                                new URL('./tests/fixtures/runtime', import.meta.url),
                            ),
                            domEnvironment: 'happy-dom',
                        },
                    },
                },
            }),
        ],
    },
})

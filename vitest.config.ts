import { fileURLToPath } from 'node:url'

import { defineVitestProject } from '@nuxt/test-utils/config'
import type { Alias } from 'vite'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

function isAliasEntry(value: unknown): value is Alias {
    return (
        typeof value === 'object' &&
        value !== null &&
        'find' in value &&
        'replacement' in value &&
        (typeof value.find === 'string' ||
            (typeof value.find === 'object' && value.find !== null && 'exec' in value.find)) &&
        typeof value.replacement === 'string'
    )
}

const capturedNuxtAliases: Array<Alias> = []

const nuxtProject = await defineVitestProject({
    root,
    test: {
        name: 'nuxt',
        fsModuleCache: process.platform !== 'win32',
        include: ['tests/nuxt/**/*.test.ts'],
        environment: 'nuxt',
        environmentOptions: {
            nuxt: {
                rootDir: fileURLToPath(new URL('./tests/fixtures/runtime', import.meta.url)),
                domEnvironment: 'happy-dom',
                overrides: {
                    hooks: {
                        'vite:configResolved'(
                            viteConfig: { resolve?: { alias?: unknown } },
                            { isClient }: { isClient: boolean },
                        ) {
                            if (!isClient || !Array.isArray(viteConfig.resolve?.alias)) {
                                return
                            }
                            for (const entry of viteConfig.resolve.alias) {
                                if (isAliasEntry(entry)) {
                                    capturedNuxtAliases.push(entry)
                                }
                            }
                        },
                    },
                },
            },
        },
    },
})

function normalizeAliases(raw: unknown): Array<Alias> {
    if (Array.isArray(raw)) {
        return raw.filter(isAliasEntry)
    }
    if (typeof raw !== 'object' || raw === null) {
        return []
    }
    const result: Array<Alias> = []
    for (const [find, replacement] of Object.entries(raw)) {
        if (typeof replacement === 'string') {
            result.push({ find, replacement })
        }
    }
    return result
}

const existingAliases = normalizeAliases(nuxtProject.resolve?.alias)

function stripNonCloneableNuxtOverrides(project: { test?: { environmentOptions?: unknown } }) {
    const envOptions = project.test?.environmentOptions
    if (typeof envOptions !== 'object' || envOptions === null || !('nuxt' in envOptions)) {
        return
    }
    const nuxtOptions = envOptions.nuxt
    if (typeof nuxtOptions !== 'object' || nuxtOptions === null) {
        return
    }
    const cleanNuxt = Object.fromEntries(
        Object.entries(nuxtOptions).filter(([key]) => key !== 'overrides'),
    )
    if (project.test) {
        project.test.environmentOptions = { ...envOptions, nuxt: cleanNuxt }
    }
}

stripNonCloneableNuxtOverrides(nuxtProject)

nuxtProject.resolve = {
    ...nuxtProject.resolve,
    alias: [...existingAliases, ...capturedNuxtAliases],
}

export default defineConfig({
    envDir: false,
    test: {
        projects: [
            {
                resolve: { dedupe: ['vue'], alias: { '~~': root } },
                test: {
                    name: 'node',
                    include: ['tests/**/*.test.ts'],
                    exclude: ['tests/nuxt/**', 'tests/fixtures/**'],
                },
            },
            nuxtProject,
        ],
    },
})

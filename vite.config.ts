import { existsSync, readFileSync } from 'node:fs'

import cloudflareConfig from '@cloudflare/oxlint-config/vite-plus'
import { defineConfig } from 'vite-plus'

const strippedPrefixes = ['react/', 'jsx-a11y/']
const strippedRules = new Set(['@nkzw/require-use-effect-arguments', 'eslint/curly'])

const baseRules = Object.fromEntries(
    Object.entries(cloudflareConfig.rules ?? {}).filter(
        ([name]) =>
            !strippedRules.has(name) && !strippedPrefixes.some((prefix) => name.startsWith(prefix)),
    ),
)

const autoImportMessage = 'Use the Nuxt auto-import directly.'

const readAutoImportPaths = (declarationUrl: URL) => {
    if (!existsSync(declarationUrl)) return []

    const declarations = readFileSync(declarationUrl, 'utf8')
    const paths = new Map<string, Array<string>>()

    for (const [, specifiers, source] of declarations.matchAll(
        /^export \{ (.+) \} from '([^']+)';$/gm,
    )) {
        if (!source || !specifiers || source.startsWith('.')) continue

        const names = specifiers.split(', ').filter((specifier) => !specifier.includes(' '))
        const sources = source.startsWith('#app/') ? [source, '#app', 'nuxt/app'] : [source]
        for (const name of sources) paths.set(name, [...(paths.get(name) ?? []), ...names])
    }

    return Array.from(paths, ([name, importNames]) => ({
        name,
        importNames,
        message: autoImportMessage,
    }))
}

const appImportsAlias = { name: '#imports', message: autoImportMessage }
const sharedAutoImportPattern = {
    regex: '(^|/|#)shared/(utils|types)(/|$)',
    message: 'Use Nuxt auto-imports for shared utilities and types.',
}
const appAutoImportPattern = {
    regex: String.raw`^(?:(?:\.\.?/)+|@/)(composables|utils)/[^/]+$`,
    message: autoImportMessage,
}
const rootAppAutoImportPattern = {
    regex: String.raw`^(?:(?:(?:\.\.?/)+|~~/|@@/)app/|~/)(composables|utils)/[^/]+$`,
    message: autoImportMessage,
}
const serverAutoImportPattern = {
    regex: String.raw`^(?:(?:\.\.?/)+(server/)?|#server/|~~/server/|@@/server/)utils/[^/]+$`,
    message: autoImportMessage,
}
const siblingAutoImportPattern = {
    regex: String.raw`^\./[^/]+$`,
    message: autoImportMessage,
}

const nuxtDirectory = new URL('.nuxt/', import.meta.url)
const appAutoImportPaths = readAutoImportPaths(new URL('imports.d.ts', nuxtDirectory))
const serverAutoImportPaths = readAutoImportPaths(
    new URL('types/server-imports.d.ts', nuxtDirectory),
)
const appImportRestrictions = {
    paths: [appImportsAlias, ...appAutoImportPaths],
    patterns: [sharedAutoImportPattern, appAutoImportPattern, rootAppAutoImportPattern],
}
const serverImportRestrictions = {
    paths: [{ name: '#imports/server', message: autoImportMessage }, ...serverAutoImportPaths],
    patterns: [sharedAutoImportPattern, serverAutoImportPattern],
}

const vitePlusConfig = defineConfig({
    fmt: {
        tabWidth: 4,
        semi: false,
        singleQuote: true,
        printWidth: 100,
        sortTailwindcss: {
            functions: ['cn'],
        },
        sortImports: {},
        sortPackageJson: {},
        ignorePatterns: [],
        overrides: [{ files: ['**/*.yml', '**/*.yaml', '**/*.md'], options: { tabWidth: 2 } }],
    },
    lint: {
        ...cloudflareConfig,
        plugins: (cloudflareConfig.plugins ?? []).filter(
            (plugin) => plugin !== 'react' && plugin !== 'jsx-a11y',
        ),
        ignorePatterns: [
            '.nuxt/**',
            'tests/fixtures/runtime/.nuxt/**',
            '.output/**',
            '.vitehub/**',
            '.wrangler/**',
            '.tmp/**',
            'node_modules/**',
            'patches/**',
        ],
        rules: { ...baseRules, curly: ['error', 'multi-or-nest'] },
        overrides: [
            ...(cloudflareConfig.overrides ?? []),
            {
                files: ['**/*.vue'],
                rules: {
                    'no-undef': 'off',
                },
            },
            {
                files: ['app/**/*.{ts,vue}', 'layers/*/app/**/*.{ts,vue}'],
                rules: { 'no-restricted-imports': ['error', appImportRestrictions] },
            },
            {
                files: ['app/{composables,utils}/*.ts', 'layers/*/app/{composables,utils}/*.ts'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            ...appImportRestrictions,
                            patterns: [...appImportRestrictions.patterns, siblingAutoImportPattern],
                        },
                    ],
                },
            },
            {
                files: ['tests/nuxt/**/*.ts'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                appImportsAlias,
                                ...appAutoImportPaths.filter(
                                    ({ name }) => name === 'vue' || name === 'cn',
                                ),
                                {
                                    name: 'vite-hub/auth/vue',
                                    importNames: ['useUserSession'],
                                    message: autoImportMessage,
                                },
                            ],
                            patterns: [sharedAutoImportPattern, rootAppAutoImportPattern],
                        },
                    ],
                },
            },
            {
                files: [
                    'server/{agents,api,forms,middleware,plugins,routes,schedules,utils}/**/*.ts',
                    'server/content.ts',
                ],
                rules: { 'no-restricted-imports': ['error', serverImportRestrictions] },
            },
            {
                files: ['server/utils/*.ts'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            ...serverImportRestrictions,
                            patterns: [
                                ...serverImportRestrictions.patterns,
                                siblingAutoImportPattern,
                            ],
                        },
                    ],
                },
            },
            {
                // ViteHub's generated auth types also load this module outside Nitro's type context.
                files: ['server/utils/localAdminAuth.ts'],
                rules: {
                    'no-restricted-imports': 'off',
                },
            },
            {
                files: ['**/*.{ts,tsx,mts,cts,vue}'],
                rules: {
                    'typescript/no-explicit-any': 'error',
                },
            },
        ],
    },
})

export default {
    ...vitePlusConfig,
    vue: {
        linter: {
            preset: 'incremental',
            rules: {
                'vue/no-v-html': 'warn',
            },
        },
    },
}

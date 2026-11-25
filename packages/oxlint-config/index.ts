import { readFileSync } from 'node:fs'

import cloudflareConfig from '@cloudflare/oxlint-config'
import { defineConfig } from 'oxlint'

const strippedPrefixes = ['react/', 'jsx-a11y/']
const strippedRules = new Set(['@nkzw/require-use-effect-arguments'])

const baseRules = Object.fromEntries(
    Object.entries(cloudflareConfig.rules ?? {}).filter(
        ([name]) =>
            !strippedRules.has(name) && !strippedPrefixes.some((prefix) => name.startsWith(prefix)),
    ),
)

const autoImportMessage = 'Use the Nuxt auto-import directly.'

function readAutoImportPaths(declarationUrl: URL) {
    const declarations = readFileSync(declarationUrl, 'utf8')
    const paths = new Map<string, Array<string>>()

    for (const [, specifiers, source] of declarations.matchAll(
        /^export \{ (.+) \} from '([^']+)';$/gm,
    )) {
        if (!source || !specifiers || source.startsWith('.')) {
            continue
        }

        const names = specifiers.split(', ').filter((specifier) => !specifier.includes(' '))
        const sources = source.startsWith('#app/') ? [source, '#app', 'nuxt/app'] : [source]
        for (const name of sources) {
            paths.set(name, [...(paths.get(name) ?? []), ...names])
        }
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

export function liry24OxlintConfig(nuxtDirectory: URL) {
    const appAutoImportPaths = readAutoImportPaths(new URL('imports.d.ts', nuxtDirectory))
    const serverAutoImportPaths = readAutoImportPaths(
        new URL('types/server-imports.d.ts', nuxtDirectory),
    )

    return defineConfig({
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
        rules: baseRules,
        overrides: [
            ...(cloudflareConfig.overrides ?? []),
            {
                files: ['**/*.vue'],
                rules: {
                    'no-undef': 'off',
                },
            },
            {
                files: ['server/**/*.ts'],
                rules: {
                    'no-restricted-imports': ['error', { patterns: [sharedAutoImportPattern] }],
                },
            },
            {
                files: ['app/**/*.{ts,vue}', 'layers/*/app/**/*.{ts,vue}'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [appImportsAlias, ...appAutoImportPaths],
                            patterns: [
                                sharedAutoImportPattern,
                                appAutoImportPattern,
                                rootAppAutoImportPattern,
                            ],
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
                files: ['server/{api,routes,middleware,plugins}/**/*.ts'],
                rules: {
                    'no-restricted-imports': [
                        'error',
                        {
                            paths: [
                                { name: '#imports/server', message: autoImportMessage },
                                ...serverAutoImportPaths,
                            ],
                            patterns: [sharedAutoImportPattern, serverAutoImportPattern],
                        },
                    ],
                },
            },
            {
                // tests/gameImport.test.ts loads this handler directly in Node.
                files: ['server/api/admin/games/index.post.ts'],
                rules: {
                    'no-restricted-imports': ['error', { patterns: [sharedAutoImportPattern] }],
                },
            },
            {
                files: [
                    'server/content.ts',
                    'server/auth.ts',
                    'server/forms/**/*.ts',
                    'server/utils/gameValidation.ts',
                ],
                rules: {
                    'no-restricted-imports': 'off',
                },
            },
            {
                files: ['**/*.{ts,tsx,mts,cts,vue}'],
                rules: {
                    'typescript/no-explicit-any': 'error',
                    '@typescript-eslint/no-explicit-any': 'error',
                },
            },
        ],
    })
}

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

export default defineConfig({
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
            files: ['app/**/*.ts', 'app/**/*.vue', 'server/**/*.ts', 'tests/nuxt/**/*.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                regex: '(^|/|#)shared/(utils|types)(/|$)',
                                message: 'Use Nuxt auto-imports for shared utilities and types.',
                            },
                        ],
                    },
                ],
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

import { defineConfig } from 'oxlint'

export default defineConfig({
    plugins: ['import'],
    categories: {
        correctness: 'error',
    },
    options: {
        typeAware: true,
    },
    overrides: [
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
            // These configuration dependencies also run directly in schema tooling.
            files: [
                'app/auth.config.ts',
                'server/auth.config.ts',
                'server/utils/entryPreparation.ts',
                'server/utils/gameValidation.ts',
            ],
            rules: { 'no-restricted-imports': 'off' },
        },
    ],
    env: {
        builtin: true,
        browser: true,
        es2024: true,
        node: true,
    },
})

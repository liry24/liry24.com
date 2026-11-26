import { defineConfig } from '@mizchi/mutator'

export default defineConfig({
    runner: 'vitest',
    vitestConfig: 'vitest.mutator.config.ts',
    // The root tsconfig is a solution file. Nuxt and test typechecking run in separate jobs.
    typecheck: false,
    include: [
        'app/utils/gameChart.ts',
        'app/utils/postEditorMentions.ts',
        'server/utils/authOrigin.ts',
        'server/utils/avatar.ts',
        'server/utils/entrySlug.ts',
        'server/utils/postCards.ts',
        'shared/utils/adminRedirect.ts',
        'shared/utils/gameMentions.ts',
        'shared/utils/games.ts',
        'shared/utils/postMarkdown.ts',
        'shared/utils/socials.ts',
    ],
})

import { defineConfig } from '@mizchi/mutator'

export default defineConfig({
    runner: 'vitest',
    vitestConfig: 'vitest.mutator.config.ts',
    // The root tsconfig is a solution file. Nuxt and test typechecking run in separate jobs.
    typecheck: false,
    include: ['app/utils/gameChart.ts', 'shared/utils/adminRedirect.ts', 'shared/utils/games.ts'],
})

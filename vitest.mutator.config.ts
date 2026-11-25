import { defineConfig } from 'vitest/config'

export default defineConfig({
    envDir: false,
    test: {
        include: [
            'tests/adminRedirect.test.ts',
            'tests/gameChart.test.ts',
            'tests/gameStats.test.ts',
        ],
    },
})

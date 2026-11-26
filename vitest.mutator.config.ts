import { resolve } from 'node:path'

import unimport from 'unimport/unplugin'
import { defineConfig } from 'vitest/config'

const root = import.meta.dirname

export default defineConfig({
    envDir: false,
    plugins: [
        unimport.vite({
            include: /\/(?:server|app\/utils)\/.*\.ts$/,
            dirs: [resolve(root, 'server/utils'), resolve(root, 'shared/utils')],
            presets: [{ from: 'vite-hub/env', imports: ['useServerEnv'] }],
        }),
    ],
    test: {
        include: [
            'tests/adminRedirect.test.ts',
            'tests/authOrigin.test.ts',
            'tests/avatar.test.ts',
            'tests/entrySlug.test.ts',
            'tests/gameChart.test.ts',
            'tests/gameMentions.test.ts',
            'tests/gameStats.test.ts',
            'tests/postCards.test.ts',
            'tests/postEditorMentions.test.ts',
            'tests/socials.test.ts',
        ],
    },
})

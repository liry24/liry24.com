import { defineConfig } from 'taze'

export default defineConfig({
    force: true,
    write: true,
    install: false,
    interactive: true,
    recursive: true,
    includeLocked: true,
    ignorePaths: ['**/node_modules/**', '**/.tmp/**', '**/.data/**'],
    ignoreOtherWorkspaces: true,
    // Native Agent 0.1 uses the 7.0.130 provider contract; vue-tsc 3.3.14 misreads the TS bridge.
    exclude: ['typescript@7', 'ai', '@ai-sdk/openai', 'vue-tsc@3.3.14'],
    depFields: {
        overrides: false,
        'bun-workspace': true,
    },
})

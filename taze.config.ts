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
    // Native Agent keeps its provider contract; newer Vue/vue-tsc break native dev SSR/the TS bridge.
    exclude: ['typescript@7', 'ai', '@ai-sdk/openai', 'vue-tsc@3.3.14', 'vue@3.6.0-rc.14'],
    depFields: {
        overrides: false,
        'bun-workspace': true,
    },
})

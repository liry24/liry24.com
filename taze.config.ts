import { defineConfig } from 'taze'

export default defineConfig({
    force: true,
    write: true,
    install: false,
    interactive: true,
    recursive: true,
    includeLocked: true,
    ignorePaths: ['**/node_modules/**'],
    ignoreOtherWorkspaces: true,
    exclude: ['typescript@7'],
    depFields: {
        overrides: false,
        'bun-workspace': true,
    },
})

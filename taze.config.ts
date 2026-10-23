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
    // 0.3.12 reads Node streams directly and breaks auth POSTs in Cloudflare Workers.
    exclude: ['typescript@7', '@nuxtjs/better-auth@0.3.12'],
    depFields: {
        overrides: false,
        'bun-workspace': true,
    },
})

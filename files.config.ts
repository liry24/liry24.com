import { defineFilesConfig } from 'nuxt-files-sdk/config'

export default defineFilesConfig({
    storage: {
        content: {
            adapter: 'r2',
            // Nitro parses the SDK's generated config as JavaScript.
            config: () => ({ binding: Reflect.get(Object(process.env), 'R2') }),
        },
    },
    $development: {
        storage: {
            content: {
                adapter: 'fs',
                config: { root: '.data/files/content' },
            },
        },
    },
})

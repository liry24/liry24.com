import { fileURLToPath } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'

const path = (value: string) => fileURLToPath(new URL(value, import.meta.url)).replaceAll('\\', '/')

export default defineNuxtConfig({
    imports: { dirs: [path('./shared/utils'), path('./shared/types')] },
    components: [{ path: path('./app/components/admin'), prefix: 'Admin' }],
    nitro: {
        imports: { dirs: [path('./server/utils'), path('./shared/utils'), path('./shared/types')] },
    },
})

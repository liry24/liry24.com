import { defineWranglerConfig } from 'wrangler/experimental-config'

export default defineWranglerConfig({
    assetsDirectory: './.output/public',
    types: { generate: false },
    dev: { ip: '127.0.0.1', port: 3100 },
})

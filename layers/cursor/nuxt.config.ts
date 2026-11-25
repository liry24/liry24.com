import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
    css: [fileURLToPath(new URL('./style.css', import.meta.url))],
})

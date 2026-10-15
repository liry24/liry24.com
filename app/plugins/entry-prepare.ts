import { prepareEntry } from '../utils/prepareEntry'
export default defineNuxtPlugin((nuxtApp) => {
    const admin = useAdminClient()
    nuxtApp.hook('site-admin:entry:prepare', (context) =>
        prepareEntry(context, (input, options) => admin.ai.run('publication', input, options)),
    )
})

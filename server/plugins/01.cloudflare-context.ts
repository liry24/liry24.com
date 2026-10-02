export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('request', attachCloudflareContext)
})

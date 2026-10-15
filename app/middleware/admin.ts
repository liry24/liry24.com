export default defineNuxtRouteMiddleware((to) => {
    to.meta.pageTransition = false
})

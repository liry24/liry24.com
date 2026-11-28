export default defineEventHandler(async (event) => {
    if (!['GET', 'HEAD'].includes(event.req.method)) return

    const path = event.url.pathname
    if (path.slice(1).includes('/')) return

    let slug: string
    try {
        slug = decodeURIComponent(path.slice(1))
    } catch {
        return
    }
    if (!socialSlug(slug)) return

    const target = (await getPublishedSocialsMap()).get(slug)
    if (target) return sendRedirect(event, target, 302)
})

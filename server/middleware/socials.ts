import content from '#server/content'

export default defineEventHandler(async (event) => {
    if (!['GET', 'HEAD'].includes(event.req.method)) {
        return
    }
    const path = event.url.pathname
    if (path.slice(1).includes('/')) {
        return
    }
    let slug: string
    try {
        slug = decodeURIComponent(path.slice(1))
    } catch {
        return
    }
    if (!socialSlug(slug)) {
        return
    }
    const socials = await listAllCollectionItems(content.collection('socials'), 'published')
    const target = socials.find((doc) => doc.data.slug === slug)?.data.href
    if (typeof target === 'string') {
        return sendRedirect(event, target, 302)
    }
})

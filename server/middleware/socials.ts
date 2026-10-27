import { defineEventHandler, sendRedirect } from 'nuxt/server'

import runtime from '#liti/runtime'

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
    const target = (await runtime.records.query('socials', { filter: { slug }, limit: 1 })).items[0]
        ?.data.href
    if (typeof target === 'string') return sendRedirect(event, target, 302)
})

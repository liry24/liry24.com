import content from '#server/content'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const { facets } = await content.collection('posts').list({
        ref: 'published',
        facets: ['tags'],
        limit: 1,
    })
    event.res.headers.set('Cache-Control', 'private, no-store')
    return { tags: (facets?.tags ?? []).map(({ value }) => value) }
})

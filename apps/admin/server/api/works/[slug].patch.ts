import { works } from '@repo/database/schema'
import { eq } from 'drizzle-orm'

const request = {
    params: worksSelectSchema.required({ slug: true }),
    body: worksUpdateSchema,
}

export default adminSessionEventHandler(async () => {
    const { slug: workSlug } = await validateParams(request.params)
    const { slug, href, title, description, category, image, icon, sortIndex } = await validateBody(
        request.body
    )

    await db
        .update(works)
        .set({
            slug,
            href,
            title,
            description,
            category,
            image,
            icon,
            sortIndex,
        })
        .where(eq(works.slug, workSlug))

    await revalidateISR()

    return {
        success: true,
    }
})

import { ranks } from '@repo/database/schema'
import { eq } from 'drizzle-orm'

const request = {
    params: ranksSelectSchema.pick({ id: true }).required({ id: true }),
    body: ranksUpdateSchema.omit({ id: true }),
}

export default adminSessionEventHandler(async () => {
    const { id } = await validateParams(request.params)
    const { game, season, rank, imageUrl, href, sortIndex } = await validateBody(request.body)

    await db
        .update(ranks)
        .set({
            game,
            season,
            rank,
            imageUrl,
            href,
            sortIndex,
        })
        .where(eq(ranks.id, id))

    await revalidateISR()

    return {
        success: true,
    }
})

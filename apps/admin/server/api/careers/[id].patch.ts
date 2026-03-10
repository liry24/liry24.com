import { careers } from '@repo/database/schema'
import { eq } from 'drizzle-orm'

const request = {
    params: careersSelectSchema.pick({ id: true }).required({ id: true }),
    body: careersUpdateSchema.omit({ id: true }),
}

export default adminSessionEventHandler(async () => {
    const { id } = await validateParams(request.params)
    const { period, position, company, sortIndex } = await validateBody(request.body)

    await db
        .update(careers)
        .set({
            period,
            position,
            company,
            sortIndex,
        })
        .where(eq(careers.id, id))

    await revalidateISR()

    return {
        success: true,
    }
})

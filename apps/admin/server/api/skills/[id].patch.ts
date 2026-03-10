import { skills } from '@repo/database/schema'
import { eq } from 'drizzle-orm'

const request = {
    params: skillsSelectSchema.pick({ id: true }).required({ id: true }),
    body: skillsUpdateSchema.omit({ id: true }),
}

export default adminSessionEventHandler(async () => {
    const { id } = await validateParams(request.params)
    const { name, icon, category, sortIndex } = await validateBody(request.body)

    await db
        .update(skills)
        .set({
            name,
            icon,
            category,
            sortIndex,
        })
        .where(eq(skills.id, id))

    await revalidateISR()

    return {
        success: true,
    }
})

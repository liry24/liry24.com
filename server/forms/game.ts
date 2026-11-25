import { createError } from 'nuxt/server'
import { defineForm } from 'vite-hub/forms'
import { z } from 'zod'

import { gameFieldsSchema } from '../../shared/schemas/content.js'
import { authorizeAdminForm, handleFormDomainError } from '../utils/forms.js'
import { gameCatalog } from '../utils/gameCatalog.js'
import { validateGameSave } from '../utils/gameValidation.js'

const gameFormSchema = z.object({
    id: z.string().min(1),
    data: gameFieldsSchema.extend({ order: z.number().finite().optional() }),
})

export default defineForm({
    schema: gameFormSchema,
    authorize: authorizeAdminForm,
    honeypot: false,
    rateLimit: false,
    store: false,
    maxBytes: 262_144,
    onSubmit: async (submission) => {
        try {
            const { id } = submission.data
            const games = gameCatalog()
            const existing = await games.get(id)
            if (!existing) {
                throw createError({ status: 404, statusText: 'Import the game from IGDB first.' })
            }
            const data = {
                ...submission.data.data,
                order: submission.data.data.order ?? existing.data.order ?? 0,
            }
            await validateGameSave({ id, data, previous: existing.data })
            if (!(await games.update(id, existing.data, data))) {
                throw createError({
                    status: 409,
                    statusText: 'The game changed. Reload and try again.',
                })
            }
            return Response.json({ id })
        } catch (error) {
            return handleFormDomainError(error)
        }
    },
})

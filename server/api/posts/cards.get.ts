import { validateData, type ContentEntry } from '@litijs/model'
import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import { z } from 'zod'

import runtime from '#liti/runtime'

import { posts } from '../../models/content'

export default defineEventHandler(async (event) => {
    const parsed = z
        .object({
            game: z.string().regex(gameSlugPattern).optional(),
            limit: z.coerce.number().int().min(1).max(1000).default(20),
            offset: z.coerce.number().int().nonnegative().default(0),
        })
        .safeParse(getQuery(event))
    if (!parsed.success) throw createError({ status: 400, statusText: 'Invalid post query' })
    const input = parsed.data
    const entries: ContentEntry[] = []
    for (let offset = 0; ; offset += 1000) {
        const page = await runtime.content.query('posts', { locale: 'ja', limit: 1000, offset })
        entries.push(...page.items)
        if (offset + page.items.length >= page.total) break
    }
    const game = input.game
        ? (await runtime.records.query('games', { filter: { slug: input.game }, limit: 1 }))
              .items[0]
        : null
    const selected = entries.filter(
        (entry) =>
            !input.game ||
            (game &&
                Array.isArray(entry.data.gameMentions) &&
                entry.data.gameMentions.includes(game.id)),
    )
    const date = (entry: ContentEntry) =>
        Date.parse(String(entry.data.authoredAt ?? entry.publication?.firstPublishedAt ?? '')) || 0
    selected.sort((a, b) => date(b) - date(a) || a.id.localeCompare(b.id))
    const page = selected.slice(input.offset, input.offset + input.limit)
    return {
        items: await postCards(
            await Promise.all(
                page.map(async (entry) => ({
                    ...entry,
                    data: await validateData(posts.fields, entry.data),
                })),
            ),
        ),
        total: selected.length,
    }
})

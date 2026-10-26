import { postGameSlugs, gameTitleParts } from '@liry24/game-mentions'
import type { ModelPreparationContext } from 'liti'

export async function preparePostGames(context: ModelPreparationContext) {
    const data = context.data as {
        title: string
        content: string
        plainTitle?: string
        gameMentions?: string[]
    }
    const slugs = await postGameSlugs(data.title, data.content)
    const games = slugs.length ? await context.read.current.listAllEntries('games') : []
    data.plainTitle = gameTitleParts(data.title)
        .map((part) => games.find((game) => game.data.slug === part.slug)?.data.name ?? part.text)
        .join('')
    data.gameMentions = games
        .filter((game) => slugs.includes(String(game.data.slug)))
        .map((game) => game.id)
}

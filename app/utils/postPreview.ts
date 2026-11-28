export const postPreviewGamesKey: InjectionKey<ReadonlyMap<string, GameSearchResult>> =
    Symbol('post-preview-games')

export const postGameMentionsKey: InjectionKey<ComputedRef<Record<string, GameMentionData>>> =
    Symbol('post-game-mentions')

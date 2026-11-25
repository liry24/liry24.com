import type { InjectionKey } from 'vue'

export const postPreviewGamesKey: InjectionKey<ReadonlyMap<string, GameSearchResult>> =
    Symbol('post-preview-games')

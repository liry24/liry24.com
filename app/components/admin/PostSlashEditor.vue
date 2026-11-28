<script setup lang="ts">
import type {
    TokenCodec,
    TokenInsert,
    TriggerDefinition,
    TriggerItemsLoader,
    TriggerMenuSelectDetails,
} from '@liry24/ui'
import {
    applyMarkdownSlashCommand,
    createMarkdownSlashCommands,
    markdownDirectTriggers,
} from '@liry24/ui/markdown'

const props = defineProps<{
    games: ReadonlyMap<string, GameSearchResult>
    placeholder: string
    multiline?: boolean
    disabled?: boolean
    required?: boolean
}>()

const model = defineModel<string>({ required: true })
const emit = defineEmits<{
    game: [game: GameSearchResult]
}>()

const codec: TokenCodec = {
    parse: (text) => postEditorTokens(text, Boolean(props.multiline), props.games),
    format: (token) => formatGameMention(token.value),
}

const searchWarning = ref('')
const searchSource = ref<GameSearchSource>()
const candidates = new Map<string, GameSearchResult>()

const tokenImageSrc = (slug: string) => {
    const game = props.games.get(slug)
    return mediaUrl(game?.icon) || game?.cover || undefined
}

const findGames: TriggerItemsLoader = async (query, { signal }) => {
    searchWarning.value = ''
    searchSource.value = undefined
    try {
        const result = await $fetch('/api/admin/games', {
            query: { q: query.trim().slice(0, 100) },
            signal,
        })
        signal.throwIfAborted()
        searchWarning.value = result.warning
        searchSource.value = result.source
        candidates.clear()
        const items = result.games.map((game) => {
            const value = `game:${game.igdbId}`
            candidates.set(value, game)
            return { value, label: game.name }
        })
        return items.slice(0, 12)
    } catch (error) {
        if (signal.aborted) throw error

        searchWarning.value = 'Game search is unavailable.'
        return []
    }
}

const gameCommand = {
    value: 'game',
    label: 'game',
    arguments: [
        {
            name: 'game',
            hint: '<name, slug or IGDB ID>',
            required: true,
            items: findGames,
            allowCustomValue: false,
        },
    ],
}
const markdownCommands = createMarkdownSlashCommands({ includeMore: true })

const triggers = computed<Array<TriggerDefinition>>(() => [
    {
        char: '/game ',
        items: findGames,
        type: 'game',
        spaces: true,
        maxLength: 100,
        pattern: /[^\s]/u,
        insert: (item) => gameToken(item.value),
    },
    ...(props.multiline ? markdownDirectTriggers : []),
    {
        char: '/',
        type: 'game',
        items: props.multiline ? [gameCommand, ...markdownCommands] : [gameCommand],
        insert: (item, details) => gameToken(details.arguments.game ?? item.value),
    },
])

const gameToken = (key: string): TokenInsert => {
    const game = candidates.get(key)
    return { type: 'game', value: game?.slug ?? '', label: game?.name ?? '' }
}

const menuMessage = (trigger: string | null, argument: string | null) => {
    if (trigger !== '/game ' && argument !== 'game') return ''
    if (searchWarning.value) return searchWarning.value
    return searchSource.value === 'emulator' ? 'Local IGDB emulator active.' : ''
}

const select = (value: string, details: TriggerMenuSelectDetails, precedingLine: string) => {
    const gameKey = details.arguments.game ?? (details.trigger === '/game ' ? value : '')
    if (gameKey) {
        const game = candidates.get(gameKey)
        if (!game) {
            details.preventDefault()
            return
        }
        emit('game', game)
        details.insert(gameToken(gameKey))
        return
    }

    if (!applyMarkdownSlashCommand(value, details, precedingLine)) details.preventDefault()
}
</script>

<template>
    <div class="grid min-w-0 gap-1">
        <UiSlashEditor
            v-model="model"
            :codec="codec"
            :triggers="triggers"
            :placeholder="placeholder"
            :multiline="multiline"
            :disabled="disabled"
            :required="required"
            :menu-message="menuMessage"
            :on-select="select"
        >
            <template #token="{ token }">
                <img
                    v-if="tokenImageSrc(token.value)"
                    :src="tokenImageSrc(token.value)"
                    alt=""
                    class="size-4 shrink-0 rounded-sm object-cover"
                />
                {{ games.get(token.value)?.name ?? token.label }}
            </template>
        </UiSlashEditor>
    </div>
</template>

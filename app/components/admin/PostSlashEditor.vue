<script setup lang="ts">
import { UiSlashEditor } from '@liry24/ui'
import type {
    TokenCodec,
    TokenInsert,
    TriggerDefinition,
    TriggerItemsLoader,
    TriggerMenuSelectDetails,
} from '@liry24/ui'

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
    pending: [delta: number]
}>()

const codec: TokenCodec = {
    parse: (text) => postEditorTokens(text, Boolean(props.multiline), props.games),
    format: (token) => formatGameMention(token.value),
}

const searchWarning = ref('')
const importWarning = ref('')
const candidates = new Map<string, GameSearchResult>()
const imports = new Map<number, AbortController>()

onScopeDispose(() => {
    for (const controller of imports.values()) controller.abort()
})

const findGames: TriggerItemsLoader = async (query, { signal }) => {
    searchWarning.value = ''
    try {
        const result = await $fetch('/api/admin/games', {
            query: { q: query.trim().slice(0, 100) },
            signal,
        })
        signal.throwIfAborted()
        searchWarning.value = result.warning
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
const headingLevels = ['1', '2', '3', '4', '5', '6']
const markdownCommands = [
    {
        value: 'heading',
        label: 'heading',
        arguments: [
            {
                name: 'level',
                hint: '<1-6>',
                required: true,
                items: headingLevels,
                allowCustomValue: false,
            },
        ],
    },
    { value: 'code', label: 'code', arguments: [{ name: 'lang', hint: '[language]' }] },
    { value: 'quote', label: 'quote' },
    { value: 'list', label: 'list' },
    { value: 'ordered', label: 'ordered' },
    { value: 'task', label: 'task' },
    {
        value: 'link',
        label: 'link',
        arguments: [
            { name: 'url', hint: '<URL>', required: true },
            { name: 'label', hint: '[label]' },
        ],
    },
    { value: 'divider', label: 'divider' },
    { value: 'more', label: 'more' },
]

const directArguments = (query: string) =>
    query.trim() ? [{ value: query.trim(), label: query.trim() }] : []

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
    ...(props.multiline
        ? [
              { char: '/heading ', items: headingLevels },
              { char: '/code ', items: directArguments },
              {
                  char: '/link ',
                  items: directArguments,
                  spaces: true,
                  maxLength: 2048,
                  pattern: /[^\s]/u,
              },
          ]
        : []),
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

const importGame = async (game: GameSearchResult): Promise<Partial<TokenInsert>> => {
    const controller = new AbortController()
    imports.set(game.igdbId, controller)
    emit('pending', 1)
    importWarning.value = ''
    try {
        const saved = await $fetch('/api/admin/games', {
            method: 'POST',
            body: { igdbId: game.igdbId },
            signal: controller.signal,
        })
        emit('game', saved)
        return { value: saved.slug, label: saved.name }
    } catch (error) {
        if (!controller.signal.aborted)
            importWarning.value = 'Could not import the game. Use /game to try again.'

        throw error
    } finally {
        imports.delete(game.igdbId)
        emit('pending', -1)
    }
}

const menuMessage = (trigger: string | null, argument: string | null) =>
    trigger === '/game ' || argument === 'game' ? searchWarning.value : ''

const select = (value: string, details: TriggerMenuSelectDetails, precedingLine: string) => {
    importWarning.value = ''
    const gameKey = details.arguments.game ?? (details.trigger === '/game ' ? value : '')
    if (gameKey) {
        const game = candidates.get(gameKey)
        if (!game || imports.has(game.igdbId)) {
            details.preventDefault()
            return
        }
        if (game.id) {
            emit('game', game)
            details.insert(gameToken(gameKey))
            return
        }
        return importGame(game)
    }

    const command = details.trigger === '/' ? value : details.trigger.slice(1).trim()
    const direct = details.trigger === '/' ? '' : value
    const blockStart = precedingLine.trim() ? '\n\n' : ''

    switch (command) {
        case 'heading':
            details.insert(`${blockStart}${'#'.repeat(Number(details.arguments.level ?? direct))} `)
            break
        case 'code': {
            const language = (details.arguments.lang ?? direct).replaceAll(/[^\w+.-]/g, '')
            details.insert(`${blockStart}\`\`\`${language}\n\n\`\`\`\n`)
            break
        }
        case 'quote':
            details.insert(blockStart + '> ')
            break
        case 'list':
            details.insert(blockStart + '- ')
            break
        case 'ordered':
            details.insert(blockStart + '1. ')
            break
        case 'task':
            details.insert(blockStart + '- [ ] ')
            break
        case 'link': {
            const [url = '', ...label] = direct.split(/\s+/)
            const href = (details.arguments.url ?? url).replaceAll(/[\s<>]/g, (char) =>
                encodeURIComponent(char),
            )
            const text = (details.arguments.label ?? (label.join(' ') || href)).replaceAll(
                /[\\[\]]/g,
                String.raw`\$&`,
            )
            details.insert(`[${text}](<${href}>)`)
            break
        }
        case 'divider':
            details.insert(`${blockStart || '\n'}---\n\n`)
            break
        case 'more':
            details.insert(`${blockStart}<!-- more -->\n\n`)
            break
        default:
            details.preventDefault()
    }
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
                    v-if="games.get(token.value)?.cover"
                    :src="games.get(token.value)?.cover || undefined"
                    alt=""
                    class="size-4 shrink-0 rounded-sm object-cover"
                />
                {{ games.get(token.value)?.name ?? token.label }}
            </template>
        </UiSlashEditor>
        <p v-if="importWarning" role="alert" class="ui-error">{{ importWarning }}</p>
    </div>
</template>

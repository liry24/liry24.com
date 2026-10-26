<script setup lang="ts">
interface Props {
    modelValue: string
    multiline?: boolean
    placeholder?: string
    disabled?: boolean
}
const { modelValue, multiline, placeholder, disabled } = defineProps<Props>()
const emit = defineEmits<{
    'update:modelValue': [value: string]
    blur: []
}>()

const root = useTemplateRef('root'),
    popupId = useId(),
    active = ref(0)
const query = ref<ReturnType<typeof gameMentionQuery>>(null)
const { games, warning, importing, importGame } = useGameSearch(() => query.value?.query ?? null)

const input = () =>
    root.value?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
const inspect = () => {
    const element = input()
    query.value = element
        ? gameMentionQuery(element.value, element.selectionStart ?? element.value.length)
        : null
    active.value = 0
}
const close = () => {
    query.value = null
}
const choose = async (game: GameSearchResult) => {
    const range = query.value,
        original = modelValue
    if (!range || importing.value) return
    const saved = await importGame(game)
    if (!saved) return
    if (
        original !== modelValue ||
        query.value?.start !== range.start ||
        query.value?.end !== range.end
    )
        return
    const mention = `<game:${saved.slug}>`
    emit('update:modelValue', original.slice(0, range.start) + mention + original.slice(range.end))
    close()
    await nextTick()
    input()?.focus()
    input()?.setSelectionRange(range.start + mention.length, range.start + mention.length)
}
const keydown = (event: KeyboardEvent) => {
    if (!query.value || event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
        event.preventDefault()
        close()
    } else if (['ArrowUp', 'ArrowDown'].includes(event.key) && games.value.length) {
        event.preventDefault()
        active.value =
            (active.value + (event.key === 'ArrowDown' ? 1 : -1) + games.value.length) %
            games.value.length
    } else if (event.key === 'Enter' && games.value[active.value]) {
        event.preventDefault()
        void choose(games.value[active.value]!)
    }
}
const blur = () => {
    close()
    emit('blur')
}
</script>

<template>
    <div
        ref="root"
        class="relative min-w-0"
        @keydown.capture="keydown"
        @input="inspect"
        @click="inspect"
        @compositionend="inspect"
        @keyup.left="inspect"
        @keyup.right="inspect"
        @focusout="blur"
    >
        <UTextarea
            v-if="multiline"
            :model-value
            :disabled
            :placeholder
            :rows="20"
            autoresize
            variant="soft"
            class="w-full"
            :ui="{ base: 'font-mono text-sm' }"
            aria-autocomplete="list"
            :aria-controls="query ? popupId : undefined"
            :aria-activedescendant="query && games[active] ? `${popupId}-${active}` : undefined"
            @update:model-value="emit('update:modelValue', $event)"
        />
        <UInput
            v-else
            :model-value
            :disabled
            :placeholder
            size="xl"
            variant="soft"
            class="w-full"
            role="combobox"
            aria-autocomplete="list"
            :aria-controls="query ? popupId : undefined"
            :aria-expanded="Boolean(query)"
            :aria-activedescendant="query && games[active] ? `${popupId}-${active}` : undefined"
            @update:model-value="emit('update:modelValue', $event)"
        />
        <div
            v-if="query"
            class="bg-elevated border-default absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border p-2 shadow-lg"
            @mousedown.prevent
            @click.stop
        >
            <div :id="popupId" role="listbox" aria-label="Games">
                <div
                    v-for="(game, index) in games"
                    :id="`${popupId}-${index}`"
                    :key="game.igdbId"
                    role="option"
                    :aria-selected="index === active"
                    :class="[
                        'cursor-pointer rounded p-2 text-sm',
                        index === active && 'bg-accented',
                    ]"
                    @pointermove="active = index"
                    @click="choose(game)"
                >
                    {{ game.name }}
                </div>
            </div>
            <p v-if="!games.length" role="status" class="text-muted p-2 text-sm">
                {{ warning || 'Type to search games. Continue writing to dismiss.' }}
            </p>
            <p v-else-if="warning" role="status" class="text-muted p-2 text-xs">{{ warning }}</p>
            <span class="text-muted px-2 text-xs">Game data by IGDB · ↑↓ Enter · Esc</span>
        </div>
    </div>
</template>

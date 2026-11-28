<script setup lang="ts">
import { UiCombobox, UiField } from '@liry24/ui'

interface GameOptionItem {
    value: string
    label: string
    game: GameSearchResult
    metricCount?: number
}

const props = defineProps<{
    selected?: GameSearchResult
    catalog: ReadonlyArray<GameCatalogItem>
    error?: string
    disabled?: boolean
}>()
const emit = defineEmits<{ select: [game: GameSearchResult] }>()

const open = ref(false)
const searchText = ref('')
const failedImages = reactive(new Set<string>())

const catalogByIgdbId = computed(() => {
    const map = new Map<number, GameCatalogItem>()
    for (const item of props.catalog) map.set(item.data.igdbId, item)
    return map
})

const {
    games: remoteGames,
    warning,
    source,
    loading,
} = useGameSearch(() => {
    if (!open.value) return null
    const trimmed = searchText.value.trim()
    return trimmed ? trimmed : null
})

const catalogResults = computed<Array<GameSearchResult>>(() =>
    props.catalog.map((item) => ({
        id: item.id,
        igdbId: item.data.igdbId,
        slug: item.data.slug,
        name: item.data.name,
        cover: item.data.cover ?? null,
        icon: item.data.icon ?? null,
    })),
)

const filteredCatalog = computed(() => {
    const trimmed = searchText.value.trim().toLowerCase()
    const numericId = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined
    return catalogResults.value.filter((game) =>
        numericId !== undefined
            ? game.igdbId === numericId
            : game.name.toLowerCase().includes(trimmed) || game.slug.includes(trimmed),
    )
})

const visibleGames = computed<Array<GameSearchResult>>(() => {
    const trimmed = searchText.value.trim()
    if (!trimmed) return catalogResults.value.slice(0, 50)

    const merged = new Map<number, GameSearchResult>()
    for (const item of filteredCatalog.value) merged.set(item.igdbId, item)
    for (const item of remoteGames.value)
        if (!merged.has(item.igdbId)) merged.set(item.igdbId, item)
    return [...merged.values()]
})

const optionItems = computed<Array<GameOptionItem>>(() =>
    visibleGames.value.map((game) => {
        const saved = catalogByIgdbId.value.get(game.igdbId)
        return {
            value: String(game.igdbId),
            label: game.name,
            game,
            metricCount: saved?.data.metrics.length,
        }
    }),
)

const optionByValue = computed(() => new Map(optionItems.value.map((item) => [item.value, item])))

const selectedValue = computed(() => (props.selected ? String(props.selected.igdbId) : ''))

function gameImageSrc(game: GameSearchResult | undefined): string | undefined {
    if (!game) return undefined
    const src = mediaUrl(game.icon) || game.cover || undefined
    return src && !failedImages.has(src) ? src : undefined
}

function handleSelect(value: string) {
    const picked = optionByValue.value.get(value)
    if (!picked) return
    emit('select', picked.game)
}
</script>

<template>
    <div class="grid gap-2">
        <UiField label="Game" :error="error" required>
            <UiCombobox
                :items="optionItems"
                :value="selectedValue"
                :display-label="selected?.name ?? ''"
                :loading="loading"
                :disabled="disabled"
                :invalid="Boolean(error)"
                name="data.game"
                placeholder="Search any game…"
                empty-text="No matching games found."
                loading-text="Searching games…"
                trigger-label="Show games"
                @open-change="open = $event"
                @query-change="searchText = $event"
                @select="handleSelect"
            >
                <template #item="{ item }">
                    <img
                        v-if="gameImageSrc(item.game)"
                        :src="gameImageSrc(item.game)"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        class="size-6 shrink-0 rounded object-cover"
                        @error="failedImages.add(gameImageSrc(item.game) ?? '')"
                    />
                    <span
                        v-else
                        class="bg-elevated text-muted flex size-6 shrink-0 items-center justify-center rounded"
                        aria-hidden="true"
                    >
                        <Icon name="mingcute:game-2-fill" class="size-3.5" />
                    </span>
                    <div class="min-w-0 flex-1">
                        <div class="truncate font-medium">{{ item.label }}</div>
                        <div class="text-muted truncate font-mono text-xs">
                            {{ item.game.slug }}
                            <span v-if="item.metricCount !== undefined">
                                · {{ item.metricCount }}
                                {{ item.metricCount === 1 ? 'metric' : 'metrics' }}
                            </span>
                        </div>
                    </div>
                </template>
                <template #footer>
                    <p
                        v-if="warning"
                        role="status"
                        class="ui-command-message border-default border-t"
                    >
                        {{ warning }}
                    </p>
                    <p
                        v-else-if="source === 'emulator'"
                        class="ui-command-message border-default border-t"
                    >
                        Local IGDB emulator active.
                    </p>
                </template>
            </UiCombobox>
        </UiField>

        <div
            v-if="selected"
            class="bg-elevated/40 border-default flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs"
        >
            <img
                v-if="gameImageSrc(selected)"
                :src="gameImageSrc(selected)"
                alt=""
                loading="lazy"
                decoding="async"
                class="size-7 shrink-0 rounded object-cover"
                @error="failedImages.add(gameImageSrc(selected) ?? '')"
            />
            <span
                v-else
                class="bg-elevated text-muted flex size-7 shrink-0 items-center justify-center rounded"
                aria-hidden="true"
            >
                <Icon name="mingcute:game-2-fill" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ selected.name }}</p>
                <p class="text-muted truncate font-mono">{{ selected.slug }}</p>
            </div>
        </div>
    </div>
</template>

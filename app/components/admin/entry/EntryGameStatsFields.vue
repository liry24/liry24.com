<script setup lang="ts">
const data = defineModel<AdminEntryData>({ required: true })
defineProps<{ errors: Record<string, string>; busy: boolean }>()
defineEmits<{ busy: [busy: boolean] }>()
const initialGame = data.value.game
const gameDrafts = reactive<Record<string, Record<string, AdminStatDraft>>>({})
if (initialGame) {
    gameDrafts[initialGame] = Object.fromEntries(
        (data.value.values ?? []).map(({ key, value, ...display }) => [
            key,
            { number: String(value), ...display },
        ]),
    )
}

const {
    data: catalog,
    error,
    status,
    refresh,
} = useLazyFetch('/api/admin/games/catalog', { key: 'admin-game-stat-catalog', server: false })

const games = computed(() => catalog.value?.items ?? [])
const selectedGame = computed(() => games.value.find((entry) => entry.id === data.value.game))
const metrics = computed(() => selectedGame.value?.data.metrics ?? [])
const draft = computed(() => gameDrafts[data.value.game ?? ''] ?? {})
const options = computed(() =>
    games.value.map(({ id, data: game }) => ({ value: id, label: game.name })),
)
const removed = computed(() =>
    Object.keys(draft.value).filter((key) => !metrics.value.some((metric) => metric.key === key)),
)
const ready = computed(() => status.value === 'success' && Boolean(selectedGame.value))

watch(
    games,
    (entries) => {
        if (!data.value.game && entries.length === 1) data.value.game = entries[0]?.id
    },
    { immediate: true },
)

watch(
    selectedGame,
    (game) => {
        if (!game) return
        const next = (gameDrafts[game.id] ??= {})
        for (const metric of game.data.metrics ?? [])
            if (!Object.hasOwn(next, metric.key)) next[metric.key] = { number: '' }
    },
    { immediate: true },
)

function getValues() {
    if (!ready.value) {
        return {
            values: [],
            errors: { 'data.game': 'Choose a saved game.' },
        }
    }
    return collectAdminStatValues(metrics.value, draft.value)
}

defineExpose({ getValues })
</script>

<template>
    <div class="grid items-start gap-5 md:grid-cols-[0.75fr_1.25fr]">
        <section class="grid gap-4" aria-label="Game and period">
            <UiField label="Game" :error="errors['data.game']" required>
                <UiSelect
                    :model-value="data.game ?? ''"
                    :options="options"
                    :disabled="status !== 'success' || !games.length"
                    name="data.game"
                    :placeholder="status === 'pending' ? 'Loading games…' : 'Choose a game'"
                    @update:model-value="data.game = $event"
                />
            </UiField>
            <div v-if="error" class="flex flex-wrap items-center gap-2">
                <p class="ui-error" role="alert">Could not load games.</p>
                <UiButton size="sm" @click="refresh()">Retry</UiButton>
            </div>
            <NuxtLink
                v-else-if="status === 'success' && !games.length"
                to="/admin/games"
                class="text-sm underline"
                >Import a game in Game settings</NuxtLink
            >
            <AdminEntryText
                v-model="data.period"
                label="Period label"
                name="data.period"
                :error="errors['data.period']"
                placeholder="Act 1"
                required
            />
            <AdminEntryText
                v-model="data.href"
                label="Profile URL"
                name="data.href"
                :error="errors['data.href']"
                placeholder="https://"
                type="url"
            />
        </section>
        <section class="grid gap-3" aria-label="Metrics">
            <h3 class="text-sm font-semibold">Metrics</h3>
            <p v-if="!selectedGame" class="ui-description">Choose a game to see its metrics.</p>
            <template v-else>
                <p v-if="!metrics.length" class="ui-description">
                    {{ selectedGame.data.name }} has no metrics.
                    <NuxtLink to="/admin/games" class="underline"
                        >Configure metrics in Game settings</NuxtLink
                    >
                </p>
                <p v-else class="ui-description">
                    Leave a value blank to omit it from this period.
                </p>
                <p v-if="errors['data.values']" class="ui-error" role="alert">
                    {{ errors['data.values'] }}
                </p>
                <UiCard
                    v-for="key in removed"
                    :key="key"
                    class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                    <span>Unavailable metric <strong class="font-mono">{{ key }}</strong></span>
                    <UiButton size="sm" @click="delete draft[key]">Remove</UiButton>
                </UiCard>
                <template v-for="metric in metrics" :key="`${selectedGame.id}:${metric.key}`">
                    <AdminEntryStatMetric
                        v-if="draft[metric.key]"
                        v-model="draft[metric.key]!"
                        :metric="metric"
                        :errors="errors"
                        :disabled="busy"
                        @busy="$emit('busy', $event)"
                    />
                </template>
            </template>
        </section>
    </div>
</template>

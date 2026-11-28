<script setup lang="ts">
interface GameDraftState {
    game: GameSearchResult
    metricsDraft: Array<AdminMetricDraft>
    primaryUid?: string
    statDraftsByUid: Record<string, AdminStatDraft>
    expandedUids: Array<string>
    unavailableKeys: Array<string>
}

export interface GameStatsSubmissionResult {
    game?: string
    values: GameStatsRecordData['values']
    gameConfig?: {
        igdbId: number
        primaryMetric?: string
        metrics: GameRecordData['metrics']
    }
    errors: Record<string, string>
}
const data = defineModel<AdminEntryData>({ required: true })
const props = defineProps<{
    errors: Record<string, string>
    busy: boolean
    editingId?: string
    catalogItems?: Array<GameCatalogItem>
    catalogMeta?: Record<string, GameCatalogMeta>
}>()
defineEmits<{ busy: [busy: boolean] }>()

const shouldFetchCatalog = computed(() => props.catalogItems === undefined)
const {
    data: fetchedCatalog,
    error: fetchError,
    refresh: refreshCatalog,
} = useLazyFetch('/api/admin/games/catalog', {
    query: { meta: '1' },
    key: 'admin-game-stat-catalog',
    server: false,
    immediate: shouldFetchCatalog.value,
})

const catalog = computed<Array<GameCatalogItem>>(
    () => props.catalogItems ?? fetchedCatalog.value?.items ?? [],
)
const catalogMeta = computed<Record<string, GameCatalogMeta>>(
    () => props.catalogMeta ?? fetchedCatalog.value?.meta ?? {},
)
const catalogById = computed(() => new Map(catalog.value.map((entry) => [entry.id, entry])))
const catalogByIgdbId = computed(
    () => new Map(catalog.value.map((entry) => [entry.data.igdbId, entry])),
)

const initialGameId = data.value.game
const initialValuesByKey = new Map(
    (data.value.values ?? []).map(({ key, value, ...display }) => [
        key,
        { number: String(value), ...display } satisfies AdminStatDraft,
    ]),
)

const statesByIgdbId = reactive<Record<number, GameDraftState>>({})
const selectedIgdbId = ref<number>()

function initGameState(game: GameSearchResult, catalogEntry?: GameCatalogItem): GameDraftState {
    const existing = statesByIgdbId[game.igdbId]
    if (existing) {
        existing.game = {
            ...existing.game,
            ...game,
            id: existing.game.id ?? catalogEntry?.id ?? game.id,
        }
        return existing
    }

    const metricsDraft = toMetricDrafts(catalogEntry?.data.metrics ?? [])
    const primaryMetricKey = catalogEntry?.data.primaryMetric
    const primaryUid = metricsDraft.find((item) => item.key === primaryMetricKey)?.uid
    const statDraftsByUid: Record<string, AdminStatDraft> = {}
    const isInitialGame = Boolean(initialGameId && catalogEntry?.id === initialGameId)
    const knownKeys = new Set(metricsDraft.map((item) => item.key))

    for (const metric of metricsDraft) {
        statDraftsByUid[metric.uid] = (isInitialGame
            ? initialValuesByKey.get(metric.key)
            : undefined) ?? { number: '' }
    }

    const unavailableKeys = isInitialGame
        ? [...initialValuesByKey.keys()].filter((key) => !knownKeys.has(key))
        : []

    const state: GameDraftState = {
        game: catalogEntry
            ? {
                  id: catalogEntry.id,
                  igdbId: catalogEntry.data.igdbId,
                  slug: catalogEntry.data.slug,
                  name: catalogEntry.data.name,
                  cover: catalogEntry.data.cover ?? null,
                  icon: catalogEntry.data.icon ?? null,
              }
            : game,
        metricsDraft,
        primaryUid,
        statDraftsByUid,
        expandedUids: [],
        unavailableKeys,
    }
    statesByIgdbId[game.igdbId] = state
    return state
}

watch(
    catalog,
    (entries) => {
        if (selectedIgdbId.value !== undefined) return
        if (data.value.game) {
            const matched = catalogById.value.get(data.value.game)
            if (matched) {
                const state = initGameState(
                    {
                        id: matched.id,
                        igdbId: matched.data.igdbId,
                        slug: matched.data.slug,
                        name: matched.data.name,
                        cover: matched.data.cover ?? null,
                        icon: matched.data.icon ?? null,
                    },
                    matched,
                )
                selectedIgdbId.value = state.game.igdbId
            }
            return
        }
        if (entries.length === 1 && !props.editingId) {
            const only = entries[0]
            if (only) {
                const state = initGameState(
                    {
                        id: only.id,
                        igdbId: only.data.igdbId,
                        slug: only.data.slug,
                        name: only.data.name,
                        cover: only.data.cover ?? null,
                        icon: only.data.icon ?? null,
                    },
                    only,
                )
                selectedIgdbId.value = state.game.igdbId
                data.value.game = only.id
            }
        }
    },
    { immediate: true },
)

const activeState = computed(() =>
    selectedIgdbId.value !== undefined ? statesByIgdbId[selectedIgdbId.value] : undefined,
)
const activeCatalogItem = computed(() =>
    selectedIgdbId.value !== undefined
        ? catalogByIgdbId.value.get(selectedIgdbId.value)
        : undefined,
)
const activeMeta = computed(() =>
    activeCatalogItem.value ? catalogMeta.value[activeCatalogItem.value.id] : undefined,
)

function handleSelectGame(game: GameSearchResult) {
    const catalogEntry = catalogByIgdbId.value.get(game.igdbId)
    const state = initGameState(game, catalogEntry)
    selectedIgdbId.value = state.game.igdbId
    data.value.game = catalogEntry?.id ?? game.id
}

function existingKeysExcept(uid: string): ReadonlySet<string> {
    const state = activeState.value
    if (!state) return new Set()
    return new Set(
        state.metricsDraft
            .filter((item) => item.uid !== uid)
            .map((item) => item.key.trim())
            .filter(Boolean),
    )
}

function isExpanded(uid: string): boolean {
    return activeState.value?.expandedUids.includes(uid) ?? false
}

function toggleExpanded(uid: string) {
    const state = activeState.value
    if (!state) return
    state.expandedUids = state.expandedUids.includes(uid)
        ? state.expandedUids.filter((id) => id !== uid)
        : [...state.expandedUids, uid]
}

function addMetric() {
    const state = activeState.value
    if (!state) return
    const existingKeys = new Set(state.metricsDraft.map((item) => item.key.trim()).filter(Boolean))
    const next = createMetricDraft(existingKeys)
    state.metricsDraft.push(next)
    state.statDraftsByUid[next.uid] = { number: '' }
    if (!state.primaryUid) state.primaryUid = next.uid
    state.expandedUids = [...state.expandedUids, next.uid]
}

function togglePrimary(uid: string) {
    const state = activeState.value
    if (!state) return
    state.primaryUid = state.primaryUid === uid ? undefined : uid
}

function removeMetric(uid: string) {
    const state = activeState.value
    if (!state) return
    state.metricsDraft = state.metricsDraft.filter((item) => item.uid !== uid)
    delete state.statDraftsByUid[uid]
    state.expandedUids = state.expandedUids.filter((id) => id !== uid)
    if (state.primaryUid === uid) state.primaryUid = state.metricsDraft[0]?.uid
}

function removeUnavailableKey(key: string) {
    const state = activeState.value
    if (!state) return
    state.unavailableKeys = state.unavailableKeys.filter((item) => item !== key)
}

function isMetricLocked(metricKey: string): boolean {
    return isGameMetricLocked(activeMeta.value, metricKey, props.editingId)
}

function getSubmission(): GameStatsSubmissionResult {
    const state = activeState.value
    if (!state) {
        return {
            values: [],
            errors: { 'data.game': 'Choose a game.' },
        }
    }

    const metricResult = collectAdminGameMetrics(state.metricsDraft, state.primaryUid)
    const valueResult = collectAdminStatValuesByUid(
        state.metricsDraft,
        metricResult.metrics,
        state.statDraftsByUid,
        state.unavailableKeys,
    )
    const errors = { ...metricResult.errors, ...valueResult.errors }

    for (const metricDraft of state.metricsDraft) {
        const prefix = `gameConfig.metrics.${metricDraft.uid}.`
        if (Object.keys(metricResult.errors).some((path) => path.startsWith(prefix))) {
            if (!state.expandedUids.includes(metricDraft.uid))
                state.expandedUids = [...state.expandedUids, metricDraft.uid]
        }
    }

    return {
        game: activeCatalogItem.value?.id ?? state.game.id,
        values: valueResult.values,
        gameConfig: {
            igdbId: state.game.igdbId,
            primaryMetric: metricResult.primaryMetric,
            metrics: metricResult.metrics,
        },
        errors,
    }
}

defineExpose({ getSubmission })
</script>

<template>
    <div class="grid items-start gap-5 md:grid-cols-[0.8fr_1.2fr]">
        <section class="grid gap-4" aria-label="Game and period">
            <AdminEntryGamePicker
                :selected="activeState?.game"
                :catalog="catalog"
                :error="errors['data.game']"
                :disabled="busy"
                @select="handleSelectGame"
            />

            <div v-if="fetchError && shouldFetchCatalog" class="flex flex-wrap items-center gap-2">
                <p class="ui-error" role="alert">Could not load saved games.</p>
                <UiButton type="button" @click="refreshCatalog()">Retry</UiButton>
            </div>

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
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Metrics</h3>
                <UiButton v-if="activeState" type="button" :disabled="busy" @click="addMetric">
                    <Icon name="mingcute:add-line" aria-hidden="true" />
                    Add metric
                </UiButton>
            </div>

            <p v-if="!activeState" class="ui-description">
                Search and select a game to configure metrics and record values.
            </p>

            <template v-else>
                <p v-if="!activeState.metricsDraft.length" class="ui-description">
                    No metrics configured for {{ activeState.game.name }} yet. Add a metric here to
                    record values without leaving this editor.
                </p>
                <p v-else class="ui-description">
                    Leave a value blank to omit it from this period.
                </p>

                <p v-if="errors['data.values']" class="ui-error" role="alert">
                    {{ errors['data.values'] }}
                </p>
                <p v-if="errors['gameConfig.metrics']" class="ui-error" role="alert">
                    {{ errors['gameConfig.metrics'] }}
                </p>

                <UiCard
                    v-for="key in activeState.unavailableKeys"
                    :key="key"
                    class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                    <span>Unavailable metric <strong class="font-mono">{{ key }}</strong></span>
                    <UiButton type="button" size="sm" @click="removeUnavailableKey(key)">
                        Remove
                    </UiButton>
                </UiCard>

                <template
                    v-for="(metricDraft, index) in activeState.metricsDraft"
                    :key="metricDraft.uid"
                >
                    <AdminEntryStatMetric
                        v-if="activeState.statDraftsByUid[metricDraft.uid]"
                        v-model="activeState.statDraftsByUid[metricDraft.uid]!"
                        :metric="{
                            key: metricDraft.key,
                            label: metricDraft.label,
                            format: metricDraft.format,
                            unit: metricDraft.unit || undefined,
                        }"
                        :path-prefix="`data.values.${metricDraft.uid}`"
                        :errors="errors"
                        :disabled="busy"
                        @busy="$emit('busy', $event)"
                    >
                        <template #actions>
                            <UBadge
                                v-if="activeState.primaryUid === metricDraft.uid"
                                variant="soft"
                                color="success"
                                size="sm"
                            >
                                Primary
                            </UBadge>
                            <UiButton
                                type="button"
                                variant="ghost"
                                :aria-expanded="isExpanded(metricDraft.uid)"
                                @click="toggleExpanded(metricDraft.uid)"
                            >
                                {{ isExpanded(metricDraft.uid) ? 'Done' : 'Configure' }}
                            </UiButton>
                        </template>

                        <template v-if="isExpanded(metricDraft.uid)" #config>
                            <AdminEntryGameMetricConfigFields
                                v-model="activeState.metricsDraft[index]!"
                                :locked="isMetricLocked(metricDraft.key)"
                                :is-primary="activeState.primaryUid === metricDraft.uid"
                                :existing-keys="existingKeysExcept(metricDraft.uid)"
                                :errors="errors"
                                :error-prefix="`gameConfig.metrics.${metricDraft.uid}`"
                                :disabled="busy"
                                @set-primary="togglePrimary(metricDraft.uid)"
                                @remove="removeMetric(metricDraft.uid)"
                            />
                        </template>
                    </AdminEntryStatMetric>
                </template>
            </template>
        </section>
    </div>
</template>

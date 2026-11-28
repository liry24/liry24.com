<script setup lang="ts">
const toast = useToast()

const [
    { data: statsData, pending: statsPending, error: statsError, refresh: refreshStats },
    { data: catalogData, pending: catalogPending, error: catalogError, refresh: refreshCatalog },
] = await Promise.all([
    useFetch('/api/admin/content/gameStats', { key: 'admin-model:gameStats' }),
    useFetch('/api/admin/games/catalog', {
        key: 'admin-game-stat-catalog-items',
    }),
])

type RawStatItem = NonNullable<typeof statsData.value>['items'][number]
type StatItem = Omit<RawStatItem, 'data'> & { data: GameStatsRecordData }

interface GameStatsGroup {
    id: string
    name: string
    slug?: string
    game?: GameCatalogItem
    items: Array<StatItem>
}

const isGameStatData = (data: CollectionDocumentData): data is GameStatsRecordData =>
    'periodKey' in data

const statItems = computed<Array<StatItem>>(() =>
    (statsData.value?.items ?? []).flatMap((item) =>
        isGameStatData(item.data) ? [{ ...item, data: item.data }] : [],
    ),
)
const catalogItems = computed<Array<GameCatalogItem>>(() => catalogData.value?.items ?? [])
const catalogMeta = shallowRef<Record<string, GameCatalogMeta>>({})
const catalogMetaRequest = shallowRef<Promise<boolean>>()
let catalogMetaLoaded = false

function invalidateCatalogMeta() {
    catalogMetaLoaded = false
    catalogMetaRequest.value = undefined
}

function ensureCatalogMeta(): Promise<boolean> {
    if (catalogMetaLoaded) return Promise.resolve(true)
    if (catalogMetaRequest.value) return catalogMetaRequest.value

    const request = $fetch('/api/admin/games/catalog', { query: { meta: '1' } })
        .then(({ meta }) => {
            if (catalogMetaRequest.value !== request) return false

            catalogMeta.value = meta ?? {}
            catalogMetaLoaded = true
            return true
        })
        .catch((error: unknown) => {
            if (catalogMetaRequest.value === request) {
                toast.add({
                    title: adminErrorMessage(error, 'Could not load game catalog details.'),
                    color: 'error',
                })
            }
            return false
        })
        .finally(() => {
            if (catalogMetaRequest.value === request) catalogMetaRequest.value = undefined
        })
    catalogMetaRequest.value = request
    return request
}

onScopeDispose(invalidateCatalogMeta)

const statCountsByGame = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const item of statItems.value) counts[item.data.game] = (counts[item.data.game] ?? 0) + 1
    return counts
})

const gameGroups = computed<Array<GameStatsGroup>>(() => {
    const byGame = new Map<string, Array<StatItem>>()
    for (const item of statItems.value) {
        const list = byGame.get(item.data.game) ?? []
        list.push(item)
        byGame.set(item.data.game, list)
    }

    const groups: Array<GameStatsGroup> = []
    for (const game of catalogItems.value) {
        const entries = byGame.get(game.id)
        if (!entries?.length) continue
        groups.push({
            id: game.id,
            name: game.data.name,
            slug: game.data.slug,
            game,
            items: entries,
        })
        byGame.delete(game.id)
    }
    for (const [gameId, entries] of byGame.entries()) {
        groups.push({
            id: gameId,
            name: gameId,
            items: entries,
        })
    }
    return groups
})

const pending = computed(() => statsPending.value || catalogPending.value)
const loadError = computed(() => statsError.value ?? catalogError.value)
const failedImages = reactive(new Set<string>())

async function refreshAll() {
    invalidateCatalogMeta()
    await Promise.all([refreshStats(), refreshCatalog()])
}

const { busyId, publishDocument, deleteDocument } = useAdminContentActions(
    'gameStats',
    refreshAll,
    'stat period',
)

// Stat entry editor state
const editorOpen = ref(false)
const editingEntry = shallowRef<AdminEntryRecord>()
const initialEntryData = shallowRef<AdminEntryData>()
const addButton = useTemplateRef<{ $el?: HTMLElement }>('addButton')
const editTrigger = shallowRef<HTMLElement | null>(null)

// Game settings & catalog modal state
const gameSettingsOpen = ref(false)
const editingGame = shallowRef<GameCatalogItem>()
const gameSettingsTrigger = shallowRef<HTMLElement | null>(null)
const catalogModalOpen = ref(false)
const manageGamesButton = useTemplateRef<{ $el?: HTMLElement }>('manageGamesButton')

// Reorder games (top-level groups)
const reorderGamesFrom = ref<Array<string> | null>(null)
const reorderGamesDraft = ref<Array<string>>([])
const savingGameOrder = ref(false)
const reorderGamesButton = useTemplateRef<{ $el?: HTMLElement }>('reorderGamesButton')

// Reorder periods within a single game group
const reorderingGroupId = ref<string | null>(null)
const reorderPeriodsFrom = ref<Array<string>>([])
const reorderPeriodsDraft = ref<Array<string>>([])
const savingPeriodOrder = ref(false)
const reorderError = ref('')

const reorderingGames = computed(() => reorderGamesFrom.value !== null)
const reorderingAny = computed(() => reorderingGames.value || reorderingGroupId.value !== null)

const visibleGameOrder = computed({
    get: () =>
        reorderingGames.value ? reorderGamesDraft.value : gameGroups.value.map((group) => group.id),
    set: (value: Array<string>) => {
        reorderGamesDraft.value = value
    },
})
const gameOrderChanged = computed(() =>
    Boolean(reorderGamesFrom.value?.some((id, index) => id !== reorderGamesDraft.value[index])),
)

function visiblePeriodOrder(group: GameStatsGroup): Array<string> {
    return reorderingGroupId.value === group.id
        ? reorderPeriodsDraft.value
        : group.items.map((item) => item.id)
}

function updatePeriodOrder(groupId: string, next: Array<string>) {
    if (reorderingGroupId.value === groupId) reorderPeriodsDraft.value = next
}

const periodOrderChanged = computed(() =>
    reorderPeriodsFrom.value.some((id, index) => id !== reorderPeriodsDraft.value[index]),
)

function beginReorderGames() {
    if (reorderingAny.value) return
    const current = gameGroups.value.map((group) => group.id)
    reorderGamesFrom.value = current
    reorderGamesDraft.value = [...current]
    reorderError.value = ''
}

async function cancelReorderGames() {
    reorderGamesFrom.value = null
    reorderError.value = ''
    await nextTick()
    reorderGamesButton.value?.$el?.focus()
}

async function saveGameOrder() {
    const fromGroup = reorderGamesFrom.value
    if (!fromGroup || !gameOrderChanged.value || savingGameOrder.value) return

    savingGameOrder.value = true
    reorderError.value = ''
    let done = false
    try {
        const allIds = catalogItems.value.map((item) => item.id)
        const nextAllIds = spliceGroupOrder(allIds, fromGroup, reorderGamesDraft.value)
        await $fetch('/api/admin/reorder', {
            method: 'POST',
            body: { model: 'games', from: allIds, to: nextAllIds },
        })
        invalidateCatalogMeta()
        await refreshCatalog()
        toast.add({ title: 'Saved game order', color: 'success' })
        done = true
    } catch (error) {
        await refreshCatalog()
        reorderError.value = adminErrorMessage(error, 'Could not save game order.')
    } finally {
        savingGameOrder.value = false
        if (done) await cancelReorderGames()
    }
}

function beginReorderPeriods(group: GameStatsGroup) {
    if (reorderingAny.value) return
    const current = group.items.map((item) => item.id)
    reorderingGroupId.value = group.id
    reorderPeriodsFrom.value = current
    reorderPeriodsDraft.value = [...current]
    reorderError.value = ''
}

function cancelReorderPeriods() {
    reorderingGroupId.value = null
    reorderPeriodsFrom.value = []
    reorderPeriodsDraft.value = []
    reorderError.value = ''
}

async function savePeriodOrder() {
    if (!reorderingGroupId.value || !periodOrderChanged.value || savingPeriodOrder.value) return

    savingPeriodOrder.value = true
    reorderError.value = ''
    let done = false
    try {
        const allIds = statItems.value.map((item) => item.id)
        const nextAllIds = spliceGroupOrder(
            allIds,
            reorderPeriodsFrom.value,
            reorderPeriodsDraft.value,
        )
        await $fetch('/api/admin/reorder', {
            method: 'POST',
            body: { model: 'gameStats', from: allIds, to: nextAllIds },
        })
        invalidateCatalogMeta()
        await refreshStats()
        toast.add({ title: 'Saved order as draft', color: 'success' })
        done = true
    } catch (error) {
        await refreshStats()
        reorderError.value = adminErrorMessage(error, 'Could not save period order.')
    } finally {
        savingPeriodOrder.value = false
        if (done) cancelReorderPeriods()
    }
}

// Editor & modal triggers
const canAdd = computed(() => !reorderingAny.value)
const { ariaKeyshortcuts: addKeys, text: addHint } = useShortcutHint('n')

async function openCreate(presetGameId?: string, trigger?: HTMLElement | null) {
    if (!canAdd.value || editorOpen.value) return
    if (!(await ensureCatalogMeta())) return

    editingEntry.value = undefined
    initialEntryData.value = presetGameId ? { game: presetGameId } : undefined
    editTrigger.value = trigger ?? addButton.value?.$el ?? null
    editorOpen.value = true
}

useShortcut(
    () => (canAdd.value && !editorOpen.value ? 'n' : null),
    () => openCreate(),
    {
        description: 'Open new stat period',
        when: () => !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'),
    },
)

async function openEdit(event: MouseEvent, item: StatItem) {
    const trigger = event.currentTarget as HTMLElement | null
    if (!(await ensureCatalogMeta())) return

    editTrigger.value = trigger
    editingEntry.value = { id: item.id, data: item.data }
    initialEntryData.value = undefined
    editorOpen.value = true
}

async function openGameSettings(item: GameCatalogItem, trigger: HTMLElement | null) {
    if (!(await ensureCatalogMeta())) return

    catalogModalOpen.value = false
    editingGame.value = { id: item.id, data: item.data }
    gameSettingsTrigger.value = trigger
    gameSettingsOpen.value = true
}

function openGameSettingsFromCatalog(item: GameCatalogItem, trigger: HTMLElement | null) {
    return openGameSettings(item, trigger ?? manageGamesButton.value?.$el ?? null)
}

async function openCatalog() {
    if (await ensureCatalogMeta()) catalogModalOpen.value = true
}

function groupImageSrc(group: GameStatsGroup): string | undefined {
    const src = mediaUrl(group.game?.data.icon) || group.game?.data.cover || undefined
    return src && !failedImages.has(src) ? src : undefined
}

function primaryMetricLabel(group: GameStatsGroup): string | undefined {
    const game = group.game?.data
    if (!game?.primaryMetric) return undefined
    return game.metrics.find((metric) => metric.key === game.primaryMetric)?.label
}

function statSummary(item: StatItem, group: GameStatsGroup): string {
    const metrics = group.game?.data.metrics ?? []
    const primaryKey = group.game?.data.primaryMetric
    const targetValue =
        (primaryKey ? item.data.values.find((entry) => entry.key === primaryKey) : undefined) ??
        item.data.values[0]
    if (!targetValue) return ''
    const metric = metrics.find((entry) => entry.key === targetValue.key)
    const formatted = formatGameValue(targetValue, metric)
    return metric ? `${metric.label}: ${formatted}` : formatted
}

useHead({ title: 'Game Stats' })
</script>

<template>
    <UDashboardPanel
        id="model-gameStats"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-4 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Game Stats" icon="mingcute:chart-line-fill">
                <template #right>
                    <UButton
                        ref="manageGamesButton"
                        label="Manage games"
                        icon="mingcute:game-2-line"
                        variant="ghost"
                        color="neutral"
                        :loading="Boolean(catalogMetaRequest)"
                        :disabled="reorderingAny"
                        @click="openCatalog"
                    />
                    <UButton
                        icon="mingcute:refresh-2-line"
                        aria-label="Refresh items"
                        variant="ghost"
                        color="neutral"
                        :loading="pending"
                        :disabled="reorderingAny"
                        @click="refreshAll()"
                    />
                    <UiButton
                        ref="addButton"
                        type="button"
                        variant="solid"
                        color="primary"
                        :aria-keyshortcuts="canAdd ? addKeys : undefined"
                        :disabled="!canAdd"
                        @click="openCreate()"
                    >
                        <Icon name="mingcute:add-line" aria-hidden="true" />
                        Add
                        <kbd
                            v-if="canAdd"
                            class="rounded border border-current px-1 font-mono text-xs"
                            aria-hidden="true"
                            >{{ addHint }}</kbd
                        >
                    </UiButton>
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UAlert
                v-if="loadError"
                role="alert"
                :title="adminErrorMessage(loadError, 'Failed to load Game Stats.')"
                color="error"
                variant="subtle"
            />

            <UAlert
                v-if="reorderError"
                role="alert"
                :title="reorderError"
                color="error"
                variant="subtle"
            />

            <div
                v-if="!pending && !loadError && gameGroups.length === 0"
                class="mx-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
            >
                <AdminHairlineFigure kind="drawer" label="No game stats entries" class="max-w-xs" />
                <p class="text-muted text-sm">
                    No game stats yet. Add a stat period and search for any game to get started.
                </p>
            </div>

            <div
                v-if="gameGroups.length > 1 || reorderingGames"
                class="flex flex-wrap items-center justify-end gap-2"
            >
                <UButton
                    ref="reorderGamesButton"
                    data-testid="toggle-reorder-games"
                    :label="reorderingGames ? 'Cancel' : 'Reorder games'"
                    :icon="reorderingGames ? undefined : 'lucide:list-ordered'"
                    color="neutral"
                    variant="outline"
                    :disabled="pending || !!busyId || savingGameOrder || Boolean(reorderingGroupId)"
                    @click="reorderingGames ? cancelReorderGames() : beginReorderGames()"
                />
                <UButton
                    v-if="reorderingGames"
                    data-testid="save-game-order"
                    label="Save game order"
                    :loading="savingGameOrder"
                    :disabled="!gameOrderChanged"
                    @click="saveGameOrder"
                />
            </div>

            <UiReorderList
                v-if="reorderingGames"
                v-model="visibleGameOrder"
                :items="gameGroups"
                :active="true"
                :disabled="savingGameOrder"
                :label="(group) => group.name"
            >
                <template #default="{ item: group }">
                    <UCard>
                        <div class="flex items-center gap-3">
                            <img
                                v-if="groupImageSrc(group)"
                                :src="groupImageSrc(group)"
                                alt=""
                                class="size-8 shrink-0 rounded object-cover"
                                @error="failedImages.add(groupImageSrc(group) ?? '')"
                            />
                            <span
                                v-else
                                class="bg-elevated text-muted flex size-8 shrink-0 items-center justify-center rounded"
                                aria-hidden="true"
                            >
                                <Icon name="mingcute:game-2-fill" class="size-4" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="truncate font-medium">{{ group.name }}</p>
                                <p class="text-muted text-xs">
                                    {{ group.items.length }}
                                    {{ group.items.length === 1 ? 'period' : 'periods' }}
                                </p>
                            </div>
                        </div>
                    </UCard>
                </template>
            </UiReorderList>

            <div v-else class="flex flex-col gap-5">
                <section
                    v-for="group in gameGroups"
                    :key="group.id"
                    :data-game-group="group.id"
                    :aria-label="group.name"
                    class="border-default bg-elevated/20 flex flex-col gap-3 rounded-xl border p-4"
                >
                    <header class="flex flex-wrap items-center justify-between gap-3">
                        <div class="flex min-w-0 flex-1 items-center gap-3">
                            <img
                                v-if="groupImageSrc(group)"
                                :src="groupImageSrc(group)"
                                alt=""
                                class="size-9 shrink-0 rounded object-cover"
                                @error="failedImages.add(groupImageSrc(group) ?? '')"
                            />
                            <span
                                v-else
                                class="bg-elevated text-muted flex size-9 shrink-0 items-center justify-center rounded"
                                aria-hidden="true"
                            >
                                <Icon name="mingcute:game-2-fill" class="size-5" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h2 class="truncate text-base font-semibold">
                                        {{ group.name }}
                                    </h2>
                                    <UBadge
                                        :label="`${group.items.length} ${group.items.length === 1 ? 'period' : 'periods'}`"
                                        color="neutral"
                                        variant="subtle"
                                        size="sm"
                                    />
                                    <UBadge
                                        v-if="primaryMetricLabel(group)"
                                        :label="`Primary: ${primaryMetricLabel(group)}`"
                                        color="neutral"
                                        variant="outline"
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <template v-if="reorderingGroupId === group.id">
                                <UButton
                                    label="Cancel"
                                    size="xs"
                                    variant="outline"
                                    color="neutral"
                                    :disabled="savingPeriodOrder"
                                    @click="cancelReorderPeriods"
                                />
                                <UButton
                                    data-testid="save-order"
                                    label="Save order"
                                    size="xs"
                                    :loading="savingPeriodOrder"
                                    :disabled="!periodOrderChanged"
                                    @click="savePeriodOrder"
                                />
                            </template>
                            <template v-else>
                                <UButton
                                    label="Add period"
                                    icon="mingcute:add-line"
                                    size="xs"
                                    variant="outline"
                                    color="neutral"
                                    :disabled="reorderingAny"
                                    @click="
                                        openCreate(
                                            group.id,
                                            $event.currentTarget as HTMLElement | null,
                                        )
                                    "
                                />
                                <UButton
                                    v-if="group.items.length > 1"
                                    data-testid="toggle-reorder"
                                    label="Reorder"
                                    icon="lucide:list-ordered"
                                    size="xs"
                                    variant="outline"
                                    color="neutral"
                                    :disabled="reorderingAny || !!busyId"
                                    @click="beginReorderPeriods(group)"
                                />
                                <UButton
                                    v-if="group.game"
                                    icon="mingcute:settings-1-line"
                                    :aria-label="`Edit ${group.name} settings`"
                                    size="xs"
                                    variant="ghost"
                                    color="neutral"
                                    :disabled="reorderingAny"
                                    @click="
                                        openGameSettings(
                                            group.game,
                                            $event.currentTarget as HTMLElement | null,
                                        )
                                    "
                                />
                            </template>
                        </div>
                    </header>

                    <UiReorderList
                        :model-value="visiblePeriodOrder(group)"
                        :items="group.items"
                        :active="reorderingGroupId === group.id"
                        :disabled="savingPeriodOrder"
                        :label="(entry) => entry.data.period"
                        @update:model-value="updatePeriodOrder(group.id, $event)"
                    >
                        <template #default="{ item }">
                            <UCard>
                                <div class="flex flex-wrap items-center justify-between gap-3">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="font-medium">{{ item.data.period }}</span>
                                            <UBadge
                                                v-if="item.status?.state"
                                                :label="item.status.state"
                                                :color="
                                                    item.status.state === 'published'
                                                        ? 'success'
                                                        : 'warning'
                                                "
                                                variant="subtle"
                                                size="sm"
                                            />
                                        </div>
                                        <p
                                            v-if="statSummary(item, group)"
                                            class="text-muted mt-1 text-xs"
                                        >
                                            {{ statSummary(item, group) }}
                                        </p>
                                    </div>

                                    <div
                                        v-if="reorderingGroupId !== group.id"
                                        class="flex flex-wrap items-center gap-2"
                                    >
                                        <UButton
                                            label="Edit"
                                            data-testid="edit-entry"
                                            size="xs"
                                            variant="outline"
                                            color="neutral"
                                            @click="openEdit($event, item)"
                                        />
                                        <UButton
                                            v-if="item.status?.state !== 'published'"
                                            label="Publish"
                                            size="xs"
                                            :loading="busyId === item.id"
                                            @click="publishDocument(item.id, item.status?.draft)"
                                        />
                                        <UButton
                                            label="Delete"
                                            size="xs"
                                            variant="ghost"
                                            color="error"
                                            :loading="busyId === item.id"
                                            @click="deleteDocument(item.id)"
                                        />
                                    </div>
                                </div>
                            </UCard>
                        </template>
                    </UiReorderList>
                </section>
            </div>

            <AdminEntryEditor
                v-model:open="editorOpen"
                model="gameStats"
                :item="editingEntry"
                :initial-data="initialEntryData"
                :catalog-items="catalogItems"
                :catalog-meta="catalogMeta"
                :final-focus="() => editTrigger"
                @saved="refreshAll()"
            />

            <AdminEntryGameSettingsEditor
                v-model:open="gameSettingsOpen"
                :item="editingGame"
                :meta="editingGame ? catalogMeta[editingGame.id] : undefined"
                :final-focus="() => gameSettingsTrigger"
                @saved="refreshAll()"
            />

            <AdminGameCatalogModal
                v-model:open="catalogModalOpen"
                :items="catalogItems"
                :meta="catalogMeta"
                :stat-counts="statCountsByGame"
                :final-focus="() => manageGamesButton?.$el ?? null"
                @edit="openGameSettingsFromCatalog"
                @deleted="refreshAll()"
            />
        </template>
    </UDashboardPanel>
</template>

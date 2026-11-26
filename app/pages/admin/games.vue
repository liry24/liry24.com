<script setup lang="ts">
import { UiReorderList } from '@liry24/ui'

type GameCatalogItem = AdminEntryRecord<GameRecordData>

const toast = useToast()
const { data, pending, error, refresh } = await useFetch<{ items: Array<GameCatalogItem> }>(
    '/api/admin/games/catalog',
    { key: 'admin-games' },
)

const items = computed(() => data.value?.items ?? [])
const currentOrder = computed(() => items.value.map((item) => item.id))
const busyId = ref<string | null>(null)
const editorOpen = ref(false)
const editingGame = shallowRef<GameCatalogItem>()
const reorderButton = useTemplateRef<{ $el?: HTMLElement }>('reorderButton')

const {
    reordering,
    visibleOrder,
    orderChanged,
    savingOrder,
    reorderError,
    beginReorder,
    cancelReorder,
    saveOrder,
} = useAdminReorder({
    model: 'games',
    currentOrder,
    refresh,
    focusToggle: () => reorderButton.value?.$el?.focus(),
})

const igdbQuery = ref('')
const {
    games: igdbResults,
    warning: igdbWarning,
    loading: igdbSearching,
    importing: igdbImporting,
    importGame,
} = useGameSearch(() => (igdbQuery.value.trim() ? igdbQuery.value.trim() : null))

const openEdit = (item: GameCatalogItem) => {
    editingGame.value = { id: item.id, data: item.data }
    editorOpen.value = true
}

const handleImportGame = async (game: GameSearchResult) => {
    const saved = await importGame(game)
    if (saved) {
        toast.add({ title: `Imported ${saved.name}`, color: 'success' })
        await refresh()
    }
}

const deleteGame = async (item: GameCatalogItem) => {
    busyId.value = item.id
    try {
        await $fetch(`/api/admin/games/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
        toast.add({ title: 'Deleted item', color: 'neutral' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Delete failed',
            description: adminErrorMessage(error_, 'Could not delete item.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const itemLabel = (item: GameCatalogItem) => item.data.name

useHead({ title: 'Game settings' })
</script>

<template>
    <UDashboardPanel
        id="model-games"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-4 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Game settings" icon="mingcute:game-2-fill">
                <template #right>
                    <UButton
                        to="/admin/gameStats"
                        label="Game Stats"
                        icon="mingcute:chart-line-fill"
                        variant="outline"
                        color="neutral"
                    />
                    <UButton
                        icon="mingcute:refresh-2-line"
                        aria-label="Refresh items"
                        variant="ghost"
                        color="neutral"
                        :loading="pending"
                        :disabled="reordering"
                        @click="refresh()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UAlert
                v-if="error"
                role="alert"
                :title="adminErrorMessage(error, 'Failed to load Game settings.')"
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

            <UCard>
                <div class="flex flex-col gap-3">
                    <h2 class="text-sm font-medium">Import from IGDB</h2>
                    <UInput
                        v-model="igdbQuery"
                        placeholder="Search games on IGDB..."
                        :loading="igdbSearching"
                    />
                    <UAlert
                        v-if="igdbWarning"
                        role="status"
                        :title="igdbWarning"
                        color="warning"
                        variant="subtle"
                    />
                    <div
                        v-for="result in igdbResults"
                        :key="`${result.igdbId}-${result.slug}`"
                        class="flex items-center justify-between gap-3 text-sm"
                    >
                        <span>{{ result.name }} ({{ result.slug }})</span>
                        <UButton
                            :label="result.id ? 'Imported' : 'Import'"
                            :disabled="Boolean(result.id) || reordering"
                            :loading="igdbImporting"
                            size="xs"
                            @click="handleImportGame(result)"
                        />
                    </div>
                </div>
            </UCard>

            <div
                v-if="!pending && !error && items.length === 0"
                class="mx-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
            >
                <AdminHairlineFigure
                    kind="drawer"
                    label="No game settings entries"
                    class="max-w-xs"
                />
                <p class="text-muted text-sm">No game settings entries yet.</p>
            </div>

            <div
                v-if="items.length > 1 || reordering"
                class="flex flex-wrap items-center justify-end gap-2"
            >
                <UButton
                    ref="reorderButton"
                    data-testid="toggle-reorder"
                    :label="reordering ? 'Cancel' : 'Reorder'"
                    :icon="reordering ? undefined : 'lucide:list-ordered'"
                    color="neutral"
                    variant="outline"
                    :disabled="pending || !!busyId || igdbImporting || savingOrder"
                    @click="reordering ? cancelReorder() : beginReorder()"
                />
                <UButton
                    v-if="reordering"
                    data-testid="save-order"
                    label="Save order"
                    :loading="savingOrder"
                    :disabled="!orderChanged"
                    @click="saveOrder"
                />
            </div>

            <UiReorderList
                v-model="visibleOrder"
                :items="items"
                :active="reordering"
                :disabled="savingOrder"
                :label="itemLabel"
            >
                <template #default="{ item }">
                    <UCard>
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <span class="font-medium">{{ itemLabel(item) }}</span>
                                <p class="text-muted mt-1 font-mono text-xs">{{ item.id }}</p>
                            </div>

                            <div v-if="!reordering" class="flex flex-wrap items-center gap-2">
                                <UButton
                                    label="Edit"
                                    data-testid="edit-entry"
                                    size="xs"
                                    variant="outline"
                                    color="neutral"
                                    @click="openEdit(item)"
                                />
                                <UButton
                                    label="Delete"
                                    size="xs"
                                    variant="ghost"
                                    color="error"
                                    :loading="busyId === item.id"
                                    @click="deleteGame(item)"
                                />
                            </div>
                        </div>
                    </UCard>
                </template>
            </UiReorderList>

            <AdminEntryGameSettingsEditor
                v-model:open="editorOpen"
                :item="editingGame"
                @saved="refresh()"
            />
        </template>
    </UDashboardPanel>
</template>

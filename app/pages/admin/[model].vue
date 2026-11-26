<script setup lang="ts">
import { UiButton, UiReorderList, useShortcut, useShortcutHint } from '@liry24/ui'
import type { ContentDocumentStatus, ContentSchedule } from '@vite-hub/content'

interface CollectionMeta {
    title: string
    icon: string
}

type AdminModel = PortfolioCollectionName | 'games'

const metaByModel: Record<AdminModel, CollectionMeta> = {
    works: { title: 'Works', icon: 'mingcute:briefcase-fill' },
    arts: { title: 'Arts', icon: 'mingcute:palette-fill' },
    careers: { title: 'Careers', icon: 'mingcute:building-2-fill' },
    skills: { title: 'Skills', icon: 'mingcute:tool-fill' },
    games: { title: 'Game settings', icon: 'mingcute:game-2-fill' },
    gameStats: { title: 'Game Stats', icon: 'mingcute:chart-line-fill' },
    socials: { title: 'Socials', icon: 'mingcute:link-2-fill' },
}

const route = useRoute()
const toast = useToast()

const modelParam = String(route.params.model ?? '')
if (!Object.hasOwn(metaByModel, modelParam))
    throw createError({ status: 404, statusText: 'Model not found' })

const model = modelParam as AdminModel
const meta = metaByModel[model]

interface AdminItem extends AdminEntryRecord<AdminEntryData | GameRecordData> {
    status?: ContentDocumentStatus | null
    schedule?: ContentSchedule | null
}

const listUrl = model === 'games' ? '/api/admin/games/catalog' : `/api/admin/content/${model}`
const { data, pending, error, refresh } = await useFetch<{ items: Array<AdminItem> }>(listUrl, {
    key: `admin-model:${model}`,
})

const items = computed(() => data.value?.items ?? [])
const busyId = ref<string | null>(null)
const editorOpen = ref(false)
const addButtonId = useId()
const editTrigger = shallowRef<HTMLElement | null>(null)
const editingEntry = shallowRef<AdminEntryRecord>()
const editingGame = shallowRef<AdminEntryRecord<GameRecordData>>()

const reorderButtonId = useId()
const reorderFrom = ref<Array<string> | null>(null)
const orderDraft = ref<Array<string>>([])
const savingOrder = ref(false)
const reorderError = ref('')
const reordering = computed(() => reorderFrom.value !== null)
const currentOrder = computed(() => items.value.map((item) => item.id))
const visibleOrder = computed({
    get: () => (reordering.value ? orderDraft.value : currentOrder.value),
    set: (value) => {
        orderDraft.value = value
    },
})
const orderChanged = computed(() =>
    reorderFrom.value?.some((id, index) => id !== orderDraft.value[index]),
)

// IGDB search state for games
const igdbQuery = ref('')
const {
    games: igdbResults,
    warning: igdbWarning,
    loading: igdbSearching,
    importing: igdbImporting,
    importGame,
} = useGameSearch(() =>
    model === 'games' && igdbQuery.value.trim() ? igdbQuery.value.trim() : null,
)

const canAdd = computed(
    () => model !== 'games' && !reordering.value && route.params.model === model,
)
const { ariaKeyshortcuts: addKeys, text: addHint } = useShortcutHint('n')

const openCreate = () => {
    if (!canAdd.value || editorOpen.value) return
    editingEntry.value = undefined
    editTrigger.value = document.getElementById(addButtonId)
    editorOpen.value = true
}

useShortcut(() => (canAdd.value && !editorOpen.value ? 'n' : null), openCreate, {
    description: 'Open new entry',
    when: () => !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'),
})

const openEdit = (event: MouseEvent, item: AdminItem) => {
    editTrigger.value = event.currentTarget as HTMLButtonElement | null
    if ('igdbId' in item.data) editingGame.value = { id: item.id, data: item.data }
    else editingEntry.value = { id: item.id, data: item.data }
    editorOpen.value = true
}

const finalFocus = () => editTrigger.value

const beginReorder = () => {
    reorderFrom.value = currentOrder.value
    orderDraft.value = currentOrder.value
    reorderError.value = ''
}

const endReorder = async () => {
    reorderFrom.value = null
    await nextTick()
    document.getElementById(reorderButtonId)?.focus()
}

const cancelReorder = () => {
    reorderError.value = ''
    void endReorder()
}

const saveOrder = async () => {
    const from = reorderFrom.value
    if (!from || !orderChanged.value || savingOrder.value) return

    savingOrder.value = true
    reorderError.value = ''
    let resetOrder = false
    try {
        await $fetch('/api/admin/reorder', {
            method: 'POST',
            body: { model, from, to: orderDraft.value },
        })
        await refresh()
        toast.add({
            title: model === 'games' ? 'Saved order' : 'Saved order as draft',
            color: 'success',
        })
        resetOrder = true
    } catch (error_) {
        if (error_ && typeof error_ === 'object' && 'status' in error_ && error_.status === 409) {
            await refresh()
            resetOrder =
                currentOrder.value.length !== from.length ||
                currentOrder.value.some((id, index) => id !== from[index])
        }
        reorderError.value = adminErrorMessage(error_, 'Could not save order.')
    } finally {
        savingOrder.value = false
        if (resetOrder) await endReorder()
    }
}

const handleImportGame = async (game: GameSearchResult) => {
    const saved = await importGame(game)
    if (saved) {
        toast.add({ title: `Imported ${saved.name}`, color: 'success' })
        await refresh()
    }
}

const publishItem = async (item: AdminItem) => {
    if (model === 'games') return

    busyId.value = item.id
    try {
        await $fetch('/api/admin/content/publish', {
            method: 'POST',
            body: {
                action: 'publish',
                collection: model,
                id: item.id,
                digest: item.status?.draft ?? null,
            },
        })
        toast.add({ title: 'Published item', color: 'success' })
        await refresh()
    } catch (error_) {
        toast.add({
            title: 'Publish failed',
            description: adminErrorMessage(error_, 'Could not publish item.'),
            color: 'error',
        })
    } finally {
        busyId.value = null
    }
}

const deleteItem = async (item: AdminItem) => {
    busyId.value = item.id
    try {
        const id = encodeURIComponent(item.id)
        if (model === 'games') await $fetch(`/api/admin/games/${id}`, { method: 'DELETE' })
        else {
            await $fetch(`/api/admin/content/${model}/${id}`, {
                method: 'DELETE',
                query: { publish: 'true' },
            })
        }

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

const itemLabel = (item: AdminItem) => {
    const record = item.data
    if ('igdbId' in record) return record.name
    return (
        record.title ??
        record.name ??
        record.label ??
        record.company ??
        record.period ??
        record.game ??
        item.id
    )
}

useHead({ title: meta.title })
</script>

<template>
    <UDashboardPanel
        :id="`model-${model}`"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-4 p-4 sm:p-6 overflow-y-auto',
        }"
    >
        <template #header>
            <UDashboardNavbar :title="meta.title" :icon="meta.icon">
                <template #right>
                    <UButton
                        v-if="model === 'gameStats'"
                        to="/admin/games"
                        label="Game settings"
                        icon="mingcute:settings-1-line"
                        variant="outline"
                        color="neutral"
                    />
                    <UButton
                        v-else-if="model === 'games'"
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
                    <UiButton
                        v-if="model !== 'games'"
                        :id="addButtonId"
                        type="button"
                        class="ui-button"
                        data-variant="primary"
                        :aria-keyshortcuts="canAdd ? addKeys : undefined"
                        :disabled="!canAdd"
                        @click="openCreate"
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
                v-if="error"
                role="alert"
                :title="adminErrorMessage(error, `Failed to load ${meta.title}.`)"
                color="error"
                variant="subtle"
                :ui="{ title: 'text-red-700 dark:text-red-400' }"
            />

            <UAlert
                v-if="reorderError"
                role="alert"
                :title="reorderError"
                color="error"
                variant="subtle"
                :ui="{ title: 'text-red-700 dark:text-red-400' }"
            />

            <UCard v-if="model === 'games'">
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
                        :ui="{ title: 'text-amber-800 dark:text-amber-300' }"
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
                <AdminHairlineDrawer
                    :label="`No ${meta.title.toLowerCase()} entries`"
                    class="max-w-xs"
                />
                <p class="text-muted text-sm">No {{ meta.title.toLowerCase() }} entries yet.</p>
            </div>

            <div
                v-if="items.length > 1 || reordering"
                class="flex flex-wrap items-center justify-end gap-2"
            >
                <UButton
                    :id="reorderButtonId"
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
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-medium">{{ itemLabel(item) }}</span>
                                    <UBadge
                                        v-if="item.status?.state"
                                        :label="item.status.state"
                                        :color="
                                            item.status.state === 'published'
                                                ? 'success'
                                                : 'warning'
                                        "
                                        :class="
                                            item.status.state === 'published'
                                                ? 'text-green-800 dark:text-green-300'
                                                : 'text-amber-800 dark:text-amber-300'
                                        "
                                        variant="subtle"
                                        size="sm"
                                    />
                                </div>
                                <p class="text-muted mt-1 font-mono text-xs">{{ item.id }}</p>
                            </div>

                            <div v-if="!reordering" class="flex flex-wrap items-center gap-2">
                                <UButton
                                    label="Edit"
                                    data-testid="edit-entry"
                                    size="xs"
                                    variant="outline"
                                    color="neutral"
                                    @click="openEdit($event, item)"
                                />
                                <UButton
                                    v-if="model !== 'games' && item.status?.state !== 'published'"
                                    label="Publish"
                                    size="xs"
                                    :loading="busyId === item.id"
                                    @click="publishItem(item)"
                                />
                                <UButton
                                    label="Delete"
                                    size="xs"
                                    variant="ghost"
                                    color="error"
                                    class="text-red-700 dark:text-red-400"
                                    :loading="busyId === item.id"
                                    @click="deleteItem(item)"
                                />
                            </div>
                        </div>
                    </UCard>
                </template>
            </UiReorderList>

            <AdminEntryGameSettingsEditor
                v-if="model === 'games'"
                v-model:open="editorOpen"
                :item="editingGame"
                @saved="refresh()"
            />
            <AdminEntryEditor
                v-else
                v-model:open="editorOpen"
                :model="model"
                :item="editingEntry"
                :final-focus="finalFocus"
                @saved="refresh()"
            />
        </template>
    </UDashboardPanel>
</template>

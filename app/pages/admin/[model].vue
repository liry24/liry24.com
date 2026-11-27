<script setup lang="ts">
const route = useRoute()

const modelParam = String(route.params.model ?? '')
if (!Object.hasOwn(portfolioCollectionMeta, modelParam))
    throw createError({ status: 404, statusText: 'Model not found' })

const model = modelParam as PortfolioCollectionName
const meta = portfolioCollectionMeta[model]
const showInternalId = model !== 'careers' && model !== 'skills'

const { data, pending, error, refresh } = await useFetch(`/api/admin/content/${model}`, {
    key: `admin-model:${model}`,
})

type AdminItem = NonNullable<typeof data.value>['items'][number]

const items = computed(() => data.value?.items ?? [])
const currentOrder = computed(() => items.value.map((item) => item.id))
const editorOpen = ref(false)
const addButton = useTemplateRef<{ $el?: HTMLElement }>('addButton')
const reorderButton = useTemplateRef<{ $el?: HTMLElement }>('reorderButton')
const editTrigger = shallowRef<HTMLElement | null>(null)
const editingEntry = shallowRef<AdminEntryRecord>()

const { busyId, publishDocument, deleteDocument } = useAdminContentActions(model, refresh, 'item')
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
    model,
    currentOrder,
    refresh,
    focusToggle: () => reorderButton.value?.$el?.focus(),
})

const canAdd = computed(() => !reordering.value && route.params.model === model)
const { ariaKeyshortcuts: addKeys, text: addHint } = useShortcutHint('n')

const openCreate = () => {
    if (!canAdd.value || editorOpen.value) return
    editingEntry.value = undefined
    editTrigger.value = addButton.value?.$el ?? null
    editorOpen.value = true
}

useShortcut(() => (canAdd.value && !editorOpen.value ? 'n' : null), openCreate, {
    description: 'Open new entry',
    when: () => !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'),
})

const openEdit = (event: MouseEvent, item: AdminItem) => {
    editTrigger.value = event.currentTarget as HTMLButtonElement | null
    editingEntry.value = { id: item.id, data: item.data }
    editorOpen.value = true
}

const finalFocus = () => editTrigger.value

const itemLabel = (item: AdminItem) => {
    const record = item.data
    if ('title' in record && record.title) return record.title
    if ('name' in record && record.name) return record.name
    if ('label' in record && record.label) return record.label
    if ('company' in record && record.company) return record.company
    if ('period' in record && record.period) return record.period
    if ('game' in record && record.game) return record.game
    return showInternalId ? item.id : `Untitled ${meta.entryLabel}`
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
                        icon="mingcute:refresh-2-line"
                        aria-label="Refresh items"
                        variant="ghost"
                        color="neutral"
                        :loading="pending"
                        :disabled="reordering"
                        @click="refresh()"
                    />
                    <UiButton
                        ref="addButton"
                        variant="solid"
                        color="primary"
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
            />

            <UAlert
                v-if="reorderError"
                role="alert"
                :title="reorderError"
                color="error"
                variant="subtle"
            />

            <div
                v-if="!pending && !error && items.length === 0"
                class="mx-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center"
            >
                <AdminHairlineFigure
                    kind="drawer"
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
                    ref="reorderButton"
                    data-testid="toggle-reorder"
                    :label="reordering ? 'Cancel' : 'Reorder'"
                    :icon="reordering ? undefined : 'lucide:list-ordered'"
                    color="neutral"
                    variant="outline"
                    :disabled="pending || !!busyId || savingOrder"
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
                                        variant="subtle"
                                        size="sm"
                                    />
                                </div>
                                <p v-if="showInternalId" class="text-muted mt-1 font-mono text-xs">
                                    {{ item.id }}
                                </p>
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

            <AdminEntryEditor
                v-model:open="editorOpen"
                :model="model"
                :item="editingEntry"
                :final-focus="finalFocus"
                @saved="refresh()"
            />
        </template>
    </UDashboardPanel>
</template>

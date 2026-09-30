<script setup lang="ts">
import type { SiteAdminDescriptor } from '@liria24/site-admin'
import type { EntryRecord, RevisionRecord } from '@liria24/site-admin/server'

import { LazyAdminFormEntryModal } from '#components'
definePageMeta({
    middleware: 'admin',
    layout: 'admin',
    key: (route) => route.params.model as string,
})
const modelName = String(useRoute().params.model)
const { data: descriptors } = await useFetch<SiteAdminDescriptor>('/api/site-admin/models')
const descriptor = descriptors.value?.models[modelName]
if (!descriptor) throw createError({ statusCode: 404 })
const {
    data: entries,
    refresh,
    error,
} = await useFetch<EntryRecord[]>('/api/site-admin/entries', {
    query: { model: modelName },
    key: `admin:${modelName}`,
    default: () => [],
})
const items = ref<EntryRecord[]>([])
watch(
    entries,
    (value) => {
        items.value = [...value]
    },
    { immediate: true },
)
const modal = useOverlay().create(LazyAdminFormEntryModal)
const failure = ref('')
const busy = ref(false)
const schedule = ref<Record<string, string>>({})
const revisions = ref<Record<string, RevisionRecord[]>>({})
const selectedRevision = ref<Record<string, string>>({})
async function history(entry: EntryRecord) {
    revisions.value[entry.id] = await $fetch(
        `/api/site-admin/entries/${encodeURIComponent(entry.id)}/revisions`,
    )
}
async function edit(data?: EntryRecord) {
    await modal.open({ modelName, descriptor: descriptor!, data }).result
    await refresh()
}
async function operation(entry: EntryRecord, action: string, extra: Record<string, unknown> = {}) {
    busy.value = true
    failure.value = ''
    try {
        await $fetch(
            `/api/site-admin/entries/${encodeURIComponent(entry.id)}${action === 'delete' ? '' : `/${action}`}`,
            {
                method: action === 'delete' ? 'DELETE' : 'POST',
                ...(action === 'delete'
                    ? { headers: { 'if-match': `"${entry.version}"` } }
                    : { body: { expectedVersion: entry.version, ...extra } }),
            },
        )
        await refresh()
    } catch (error: any) {
        failure.value =
            error.data?.error?.code === 'SITE_ADMIN_CONFLICT'
                ? 'Conflict detected. Reload latest.'
                : error.data?.error?.message || error.message
    } finally {
        busy.value = false
    }
}
async function reorder(order: EntryRecord[]) {
    if (busy.value) return
    busy.value = true
    failure.value = ''
    try {
        await $fetch(`/api/site-admin/entries/${encodeURIComponent(modelName)}/reorder`, {
            method: 'POST',
            body: {
                items: order.map((entry, sortOrder) => ({
                    id: entry.id,
                    sortOrder,
                    expectedVersion: entry.version,
                })),
            },
        })
    } catch (error: any) {
        failure.value = error.data?.error?.message || error.message
    } finally {
        await refresh()
        busy.value = false
    }
}
function move(index: number, offset: number) {
    const target = index + offset
    if (busy.value || target < 0 || target >= items.value.length) return
    const order = [...items.value]
    ;[order[index], order[target]] = [order[target]!, order[index]!]
    items.value = order
    void reorder(order)
}
</script>

<template>
    <AdminResourcePage :title="modelName" :count="items.length">
        <template #actions>
            <UButton label="Reload latest" :disabled="busy" @click="refresh()" />
            <UButton label="Create" @click="edit()" />
        </template>

        <UAlert v-if="failure || error" :title="failure || error?.message" color="error" />

        <AdminResourceSortableList
            v-model="items"
            :disabled="!descriptor?.sortable || busy"
            @reorder="reorder"
        >
            <template #default="{ item }">
                <AdminResourceSortableItem
                    :sortable="descriptor?.sortable"
                    @up="move(items.indexOf(item), -1)"
                    @down="move(items.indexOf(item), 1)"
                >
                    <p>{{ item.data[descriptor?.displayFields?.title || 'title'] || item.slug }}</p>

                    <div class="mt-2 flex flex-wrap gap-2">
                        <AdminResourceMeta label="current" :value="item.currentRevisionId" />
                        <AdminResourceMeta label="published" :value="item.publishedRevisionId" />
                        <AdminResourceMeta label="scheduled" :value="item.scheduledRevisionId" />
                    </div>

                    <div class="mt-3 flex flex-wrap gap-2">
                        <UButton
                            label="Publish"
                            :disabled="busy"
                            @click="operation(item, 'publish')"
                        />
                        <UButton
                            v-if="item.publishedRevisionId"
                            label="Unpublish"
                            :disabled="busy"
                            @click="operation(item, 'unpublish')"
                        />
                        <input
                            v-model="schedule[item.id]"
                            type="datetime-local"
                            aria-label="Schedule publish time"
                        />
                        <UButton
                            label="Schedule Publish"
                            :disabled="busy || !schedule[item.id]"
                            @click="
                                operation(item, 'schedule', {
                                    at: new Date(schedule[item.id]!).toISOString(),
                                })
                            "
                        />
                        <UButton
                            v-if="item.scheduledRevisionId"
                            label="Cancel Schedule"
                            :disabled="busy"
                            @click="operation(item, 'cancel-schedule')"
                        />
                        <UButton label="Revision history" :disabled="busy" @click="history(item)" />

                        <template v-if="revisions[item.id]">
                            <select
                                v-model="selectedRevision[item.id]"
                                aria-label="Revision to restore"
                            >
                                <option
                                    v-for="revision in revisions[item.id]"
                                    :key="revision.id"
                                    :value="revision.id"
                                >
                                    {{ revision.createdAt }} — {{ revision.id }}
                                </option>
                            </select>
                            <UButton
                                label="Restore as draft"
                                :disabled="busy || !selectedRevision[item.id]"
                                @click="
                                    operation(
                                        item,
                                        `revisions/${selectedRevision[item.id]}/restore`,
                                    )
                                "
                            />
                        </template>
                    </div>

                    <template #actions>
                        <UButton
                            aria-label="Edit"
                            icon="mingcute:edit-3-fill"
                            variant="ghost"
                            :disabled="busy"
                            @click="edit(item)"
                        />
                        <UButton
                            aria-label="Delete"
                            icon="mingcute:close-line"
                            variant="ghost"
                            :disabled="busy"
                            @click="operation(item, 'delete')"
                        />
                    </template>
                </AdminResourceSortableItem>
            </template>
        </AdminResourceSortableList>
    </AdminResourcePage>
</template>

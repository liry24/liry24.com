<script setup lang="ts">
import type { Revision } from '@liria24/site-admin'

import { LazyAdminFormEntryModal } from '#components'

definePageMeta({
    key: (route) => ('model' in route.params ? String(route.params.model) : route.path),
})
const route = useRoute('admin-model')
const modelName = String(route.params.model)
const resource = await useAdminEntries(modelName, {
    all: modelName !== 'posts',
    q: () => String(route.query.q ?? ''),
})
const { data, error, status, page, features, meta: presentation } = resource
const items = computed(() => data.value?.items ?? [])
type Entry = (typeof items.value)[number]
const count = computed(() => data.value?.total ?? 0)
const busy = computed(() => status.value === 'pending')
const pageSize = 20
const modal = useOverlay().create(LazyAdminFormEntryModal)
const schedule = ref<Record<string, string>>({})
const revisions = ref<Record<string, Revision[]>>({})
const selectedRevision = ref<Record<string, string>>({})
async function history(entry: Entry) {
    revisions.value[entry.id] = (await resource.revisions(entry)) ?? []
}
async function edit(data?: Entry) {
    if (modelName === 'posts') {
        await navigateTo(data ? `/admin/posts/${encodeURIComponent(data.id)}` : '/admin/posts/new')
        return
    }
    await modal.open({
        modelName,
        id: data?.id,
        categories: [
            ...new Set(
                items.value
                    .map((entry) => Reflect.get(entry.data, 'category'))
                    .filter(
                        (value): value is string => typeof value === 'string' && Boolean(value),
                    ),
            ),
        ],
    }).result
}
defineShortcuts({ n: () => edit() })
function move(index: number, offset: number) {
    const target = index + offset
    if (busy.value || target < 0 || target >= items.value.length) return
    const order = [...items.value]
    ;[order[index], order[target]] = [order[target]!, order[index]!]
    void resource.reorder(order)
}
const imageUrl = (entry: Entry) => resource.display(entry.data).image
const fieldValue = (entry: Entry, field: string) => Reflect.get(entry.data, field)
</script>

<template>
    <AdminResourcePage :title="presentation.plural" :icon="presentation.icon" :count>
        <template #trailing>
            <UButton
                aria-label="Reload latest"
                title="Refresh"
                icon="mingcute:refresh-2-line"
                variant="ghost"
                size="sm"
                :disabled="busy"
                loading-auto
                @click="resource.refresh()"
            />
        </template>
        <template #actions>
            <UButton
                :label="`New ${presentation.label}`"
                icon="mingcute:add-line"
                variant="outline"
                color="neutral"
                :ui="{ leadingIcon: 'size-4.5' }"
                @click="edit()"
            >
                <template #trailing><UKbd value="n" class="hidden sm:inline-flex" /></template>
            </UButton>
        </template>

        <UAlert v-if="error" :title="error.message" color="error" />

        <AdminResourceSortableList
            :items="items"
            :disabled="!features.sortable || busy"
            @reorder="resource.reorder"
        >
            <template #default="{ item }">
                <AdminResourceSortableItem
                    :sortable="features.sortable"
                    :class="modelName === 'works' && 'bg-muted/70 ring-muted/50 rounded-xl px-3'"
                    @up="move(items.indexOf(item), -1)"
                    @down="move(items.indexOf(item), 1)"
                >
                    <template #leading>
                        <img
                            v-if="imageUrl(item)"
                            :src="imageUrl(item)"
                            alt=""
                            class="size-12 shrink-0 rounded-lg object-cover"
                        />
                        <UIcon
                            v-else-if="
                                typeof fieldValue(item, 'icon') === 'string' &&
                                fieldValue(item, 'icon')
                            "
                            :name="String(fieldValue(item, 'icon'))"
                            class="size-5 shrink-0"
                        />
                    </template>
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm leading-snug">
                            {{ resource.display(item.data).title }}
                        </p>
                        <UBadge
                            :label="
                                item.publishedRevisionId
                                    ? item.currentRevisionId === item.publishedRevisionId
                                        ? 'Published'
                                        : 'Unpublished changes'
                                    : 'Draft'
                            "
                            color="neutral"
                            variant="subtle"
                            size="sm"
                        />
                        <UBadge
                            v-if="item.scheduledAt"
                            label="Scheduled"
                            icon="mingcute:time-line"
                            color="neutral"
                            variant="subtle"
                            size="sm"
                        />
                    </div>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <template v-for="field in presentation.fields" :key="field">
                            <AdminResourceMeta
                                v-if="modelName === 'works' && fieldValue(item, field)"
                                :label="field"
                                :value="fieldValue(item, field)"
                            />
                            <span
                                v-else-if="modelName !== 'works' && fieldValue(item, field)"
                                class="text-muted text-sm wrap-break-word"
                                >{{ fieldValue(item, field) }}</span
                            >
                        </template>
                    </div>
                    <details v-if="features.publishing || features.revisions" class="group mt-3">
                        <summary
                            class="text-muted hover:text-default flex w-fit cursor-pointer list-none items-center gap-1 text-xs"
                        >
                            <UIcon
                                name="mingcute:down-line"
                                class="size-3.5 transition-transform group-open:rotate-180"
                            />
                            Publishing &amp; history
                        </summary>
                        <div
                            class="border-default mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                        >
                            <UButton
                                v-if="features.publishing"
                                :label="modelName === 'posts' ? 'Edit & Publish' : 'Publish'"
                                icon="mingcute:upload-3-fill"
                                variant="soft"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="modelName === 'posts' ? edit(item) : resource.publish(item)"
                            />
                            <UButton
                                v-if="features.publishing && item.publishedRevisionId"
                                label="Unpublish"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="resource.unpublish(item)"
                            />
                            <UInput
                                v-if="features.scheduling && modelName !== 'posts'"
                                v-model="schedule[item.id]"
                                type="datetime-local"
                                aria-label="Schedule publish time"
                                variant="soft"
                                size="sm"
                            />
                            <UButton
                                v-if="features.scheduling && modelName !== 'posts'"
                                label="Schedule Publish"
                                variant="soft"
                                color="neutral"
                                size="sm"
                                :disabled="busy || !schedule[item.id]"
                                @click="resource.schedule(item, schedule[item.id]!)"
                            />
                            <UButton
                                v-if="item.scheduledRevisionId"
                                label="Cancel Schedule"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="resource.cancelSchedule(item)"
                            />
                            <UButton
                                v-if="features.revisions"
                                label="Revision history"
                                icon="mingcute:history-line"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="history(item)"
                            />

                            <template v-if="revisions[item.id]">
                                <USelect
                                    v-model="selectedRevision[item.id]"
                                    aria-label="Revision to restore"
                                    :items="
                                        revisions[item.id]?.map((revision) => ({
                                            label: `${new Date(revision.createdAt).toLocaleString()} — ${revision.data.slug ?? revision.id}`,
                                            value: revision.id,
                                        }))
                                    "
                                    placeholder="Select a revision"
                                    variant="soft"
                                    size="sm"
                                    class="w-full sm:max-w-72"
                                />
                                <UButton
                                    label="Restore as draft"
                                    variant="soft"
                                    color="neutral"
                                    size="sm"
                                    :disabled="busy || !selectedRevision[item.id]"
                                    @click="resource.restore(item, selectedRevision[item.id]!)"
                                />
                            </template>
                        </div>
                    </details>

                    <template #actions>
                        <UButton
                            aria-label="Edit"
                            icon="mingcute:edit-3-fill"
                            variant="ghost"
                            size="sm"
                            :disabled="busy"
                            @click="edit(item)"
                        />
                        <UButton
                            aria-label="Delete"
                            icon="mingcute:close-line"
                            variant="ghost"
                            size="sm"
                            :disabled="busy"
                            @click="resource.remove(item)"
                        />
                    </template>
                </AdminResourceSortableItem>
            </template>
        </AdminResourceSortableList>
        <UPagination
            v-if="modelName === 'posts' && count > pageSize"
            v-model:page="page"
            :total="count"
            :items-per-page="pageSize"
            :disabled="busy"
            aria-label="Post pages"
        />
    </AdminResourcePage>
</template>

<script setup lang="ts">
import type { SiteAdminDescriptor } from '@liria24/site-admin'
import { managementAssetUrl, type SiteAdminManagementModels } from '@liria24/site-admin/client'
import type { EntryRecord, RevisionRecord } from '@liria24/site-admin/server'

import { LazyAdminFormEntryModal } from '#components'
definePageMeta({
    middleware: 'admin',
    layout: 'admin',
    key: (route) => ('model' in route.params ? String(route.params.model) : route.path),
})
const modelName = String(useRoute('admin-model').params.model)
const presentation = adminModels[modelName as keyof typeof adminModels]
const { data: descriptors } = await useFetch<SiteAdminDescriptor>('/api/site-admin/models')
const descriptor = descriptors.value?.models[modelName]
if (!descriptor || !presentation) throw createError({ statusCode: 404 })
const management = useSiteAdminManagementClient()
const page = ref(1)
const pageSize = 20
const posts =
    modelName === 'posts'
        ? await useSiteAdminManagementList('posts', {
              limit: pageSize,
              offset: () => (page.value - 1) * pageSize,
          })
        : undefined
const allEntries =
    modelName === 'posts'
        ? undefined
        : await useAsyncData(
              `admin:${modelName}`,
              () => management.listAllEntries(modelName as keyof SiteAdminManagementModels),
              { default: () => [] },
          )
const entries = computed(() => (posts ? (posts.data.value?.items ?? []) : allEntries!.data.value))
const error = computed(() => (posts ? posts.error.value : allEntries!.error.value))
const count = computed(() => (posts ? (posts.data.value?.total ?? 0) : items.value.length))
const pending = computed(() => posts?.pending.value ?? false)
const refresh = () => (posts ? posts.refresh() : allEntries!.refresh())
watch(
    () => posts?.data.value?.total,
    (total) => {
        if (total !== undefined)
            page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize)))
    },
)
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
    revisions.value[entry.id] = await management.listRevisions(entry.id)
}
async function edit(data?: EntryRecord) {
    if (modelName === 'posts') {
        await navigateTo(data ? `/admin/posts/${encodeURIComponent(data.id)}` : '/admin/posts/new')
        return
    }
    await modal.open({
        modelName,
        descriptor: descriptor!,
        data,
        categories: [
            ...new Set(
                items.value
                    .map((entry) => entry.data.category)
                    .filter(
                        (value): value is string => typeof value === 'string' && Boolean(value),
                    ),
            ),
        ],
    }).result
    await refresh()
}
defineShortcuts({ n: () => edit() })
async function operation(entry: EntryRecord, action: string, extra: Record<string, unknown> = {}) {
    if (busy.value) return
    busy.value = true
    failure.value = ''
    try {
        if (modelName === 'posts' && action === 'unpublish') {
            await unpublishPost(management, descriptor!, entry)
            await refresh()
            return
        }
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
function imageUrl(entry: EntryRecord) {
    const image = entry.data[descriptor!.displayFields?.image || 'images']
    if (modelName === 'posts') {
        return image && typeof image === 'object' && 'url' in image && typeof image.url === 'string'
            ? image.url
            : undefined
    }
    const id = adminAssetId(image)
    return id ? managementAssetUrl(id) : undefined
}
</script>

<template>
    <AdminResourcePage :title="presentation.label" :icon="presentation.icon" :count>
        <template #trailing>
            <UButton
                aria-label="Reload latest"
                title="Refresh"
                icon="mingcute:refresh-2-line"
                variant="ghost"
                size="sm"
                :disabled="busy || pending"
                loading-auto
                @click="refresh()"
            />
        </template>
        <template #actions>
            <UButton
                :label="`New ${presentation.singular}`"
                icon="mingcute:add-line"
                variant="outline"
                color="neutral"
                :ui="{ leadingIcon: 'size-4.5' }"
                @click="edit()"
            >
                <template #trailing><UKbd value="n" class="hidden sm:inline-flex" /></template>
            </UButton>
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
                            v-else-if="typeof item.data.icon === 'string' && item.data.icon"
                            :name="item.data.icon"
                            class="size-5 shrink-0"
                        />
                    </template>
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm leading-snug">
                            {{
                                item.data[descriptor?.displayFields?.title || 'title'] || item.slug
                            }}
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
                                v-if="
                                    modelName === 'works' &&
                                    (field === 'slug' ? item.slug : item.data[field])
                                "
                                :label="field"
                                :value="field === 'slug' ? item.slug : item.data[field]"
                            />
                            <span
                                v-else-if="
                                    modelName !== 'works' &&
                                    (field === 'slug' ? item.slug : item.data[field])
                                "
                                class="text-muted text-sm wrap-break-word"
                                >{{ field === 'slug' ? item.slug : item.data[field] }}</span
                            >
                        </template>
                    </div>
                    <details class="group mt-3">
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
                                :label="modelName === 'posts' ? 'Edit & Publish' : 'Publish'"
                                icon="mingcute:upload-3-fill"
                                variant="soft"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="
                                    modelName === 'posts' ? edit(item) : operation(item, 'publish')
                                "
                            />
                            <UButton
                                v-if="item.publishedRevisionId"
                                label="Unpublish"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="operation(item, 'unpublish')"
                            />
                            <UInput
                                v-if="modelName !== 'posts'"
                                v-model="schedule[item.id]"
                                type="datetime-local"
                                aria-label="Schedule publish time"
                                variant="soft"
                                size="sm"
                            />
                            <UButton
                                v-if="modelName !== 'posts'"
                                label="Schedule Publish"
                                variant="soft"
                                color="neutral"
                                size="sm"
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
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                :disabled="busy"
                                @click="operation(item, 'cancel-schedule')"
                            />
                            <UButton
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
                                            label: `${new Date(revision.createdAt).toLocaleString()} — ${revision.slug}`,
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
                                    @click="
                                        operation(
                                            item,
                                            `revisions/${selectedRevision[item.id]}/restore`,
                                        )
                                    "
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
                            @click="operation(item, 'delete')"
                        />
                    </template>
                </AdminResourceSortableItem>
            </template>
        </AdminResourceSortableList>
        <UPagination
            v-if="posts && count > pageSize"
            v-model:page="page"
            :total="count"
            :items-per-page="pageSize"
            :disabled="busy || pending"
            aria-label="Post pages"
        />
    </AdminResourcePage>
</template>

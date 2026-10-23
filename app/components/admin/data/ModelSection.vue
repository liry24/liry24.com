<script setup lang="ts">
import type { Entry } from 'liti'
import { createLitiClient, type RegisteredLitiSchema } from 'liti/client'

import { LazyAdminFormEntryModal } from '#components'

const { modelName } = defineProps<{ modelName: string }>()
const route = useRoute()
const router = useRouter()
const modal = useOverlay().create(LazyAdminFormEntryModal)
const query = computed(() =>
    String(route.query.model ?? 'posts') === modelName ? String(route.query.q ?? '') : '',
)
const page = ref(1)
const { data, status, error, total, refresh } = useLitiQuery(
    modelName as keyof RegisteredLitiSchema['managementModels'],
    {
        view: 'current',
        q: query,
        ...(modelName === 'posts'
            ? { page: () => ({ limit: 20, offset: (page.value - 1) * 20 }) }
            : {}),
    },
)
const items: Readonly<Ref<Entry[]>> = data
const { data: models } = useLitiModels()
const model = computed(() => models.value[modelName as keyof typeof models.value])
const features = computed(
    () =>
        model.value?.features ?? {
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: false,
        },
)
const meta = computed(
    () => model.value?.meta ?? { label: modelName, plural: modelName, fields: [] },
)
const client = createLitiClient()
const moving = ref(false)
const mutationError = ref('')
const busy = computed(() => status.value === 'pending' || moving.value)
const display = (data: Record<string, unknown>) => {
    const fields = model.value?.displayFields
    const image = data[fields?.image ?? 'image']
    return {
        title: String(data[fields?.title ?? 'title'] ?? ''),
        image: image && typeof image === 'object' && 'url' in image ? String(image.url) : undefined,
    }
}
async function reorder(entries: Entry[]) {
    if (busy.value) return
    moving.value = true
    mutationError.value = ''
    try {
        await client.setSortOrders(
            modelName as keyof RegisteredLitiSchema['managementModels'],
            entries.map((entry, sortOrder) => ({
                id: entry.id,
                sortOrder,
                expectedVersion: entry.version,
            })),
        )
        await refresh()
    } catch (cause) {
        mutationError.value = cause instanceof Error ? cause.message : 'Could not reorder entries.'
    } finally {
        moving.value = false
    }
}
const sortable = computed(() => features.value.sortable && !busy.value && !query.value)

async function edit(entry?: Entry) {
    const changed = await modal.open({
        modelName,
        id: entry?.id,
        categories: [
            ...new Set(
                items.value
                    .map((item) => item.data.category)
                    .filter(
                        (value): value is string => typeof value === 'string' && Boolean(value),
                    ),
            ),
        ],
    }).result
    if (changed) await refresh()
}

function move(index: number, offset: number) {
    const target = index + offset
    if (!sortable.value || target < 0 || target >= items.value.length) return
    const order = [...items.value]
    ;[order[index], order[target]] = [order[target]!, order[index]!]
    void reorder(order)
}

const publication = (entry: Entry) =>
    entry.publishedRevisionId
        ? entry.currentRevisionId === entry.publishedRevisionId
            ? 'Published'
            : 'Unpublished changes'
        : 'Draft'
</script>

<template>
    <section
        :id="`model-${modelName}`"
        ref="section"
        class="flex min-w-0 scroll-mt-6 flex-col gap-4"
        :aria-label="meta.plural"
        :data-model="modelName"
    >
        <div class="flex flex-wrap items-center gap-2">
            <h2 class="mr-auto text-sm">
                {{ meta.plural }} <span class="text-dimmed ml-1">{{ total }}</span>
            </h2>
            <UButton
                v-if="query"
                :label="`Clear search: ${query}`"
                variant="ghost"
                color="neutral"
                @click="router.replace({ query: { ...route.query, q: undefined } })"
            />
        </div>
        <UAlert
            v-if="error || mutationError"
            :title="error?.message || mutationError"
            color="error"
        />
        <USkeleton
            v-if="!items.length && (busy || status === 'idle')"
            class="h-32 w-full rounded-xl"
        />
        <template v-else>
            <UScrollArea orientation="horizontal" class="w-full" :ui="{ viewport: 'gap-2' }">
                <AdminResourceSortableList
                    :items
                    :disabled="!sortable"
                    class="flex w-max shrink-0 gap-2"
                    @reorder="reorder"
                >
                    <template #default="{ item }">
                        <article
                            class="bg-muted/60 border-muted/30 hover:border-muted/60 flex h-full w-64 flex-col gap-3 rounded-xl border px-6 py-5 text-sm transition"
                        >
                            <div class="flex items-center gap-2">
                                <button
                                    v-if="features.sortable"
                                    type="button"
                                    class="resource-drag-handle text-muted cursor-grab touch-none"
                                    aria-label="Reorder (arrow keys move item)"
                                    :disabled="!sortable"
                                    @keydown.left.prevent="move(items.indexOf(item), -1)"
                                    @keydown.right.prevent="move(items.indexOf(item), 1)"
                                    @keydown.up.prevent="move(items.indexOf(item), -1)"
                                    @keydown.down.prevent="move(items.indexOf(item), 1)"
                                >
                                    <UIcon name="mingcute:dot-grid-fill" class="size-4" />
                                </button>
                                <img
                                    v-if="display(item.data).image"
                                    :src="display(item.data).image"
                                    alt=""
                                    class="size-8 rounded-lg object-cover"
                                />
                                <UIcon
                                    v-else-if="typeof item.data.icon === 'string' && item.data.icon"
                                    :name="item.data.icon"
                                    class="size-5 shrink-0"
                                />
                                <button
                                    type="button"
                                    class="min-w-0 flex-1 truncate text-left hover:underline"
                                    @click="edit(item)"
                                >
                                    {{ display(item.data).title || item.id }}
                                </button>
                            </div>
                            <p class="text-dimmed truncate text-xs">
                                {{ item.data.slug || item.id }}
                            </p>
                            <div
                                v-for="field in meta.fields"
                                :key="field"
                                class="text-muted truncate text-xs"
                            >
                                <template
                                    v-if="
                                        typeof item.data[field] === 'string' ||
                                        typeof item.data[field] === 'number'
                                    "
                                >
                                    {{ item.data[field] }}
                                </template>
                            </div>
                            <div class="mt-auto flex flex-wrap items-center gap-1">
                                <UBadge
                                    v-if="features.publishing"
                                    :label="publication(item)"
                                    color="neutral"
                                    variant="subtle"
                                    size="sm"
                                />
                                <UBadge
                                    v-if="item.scheduledAt"
                                    label="Scheduled"
                                    color="neutral"
                                    variant="subtle"
                                    size="sm"
                                />
                                <AdminDataEntryActions
                                    :entry="item"
                                    :features
                                    :busy
                                    :title="display(item.data).title"
                                    @changed="refresh()"
                                    class="ml-auto"
                                    @edit="edit(item)"
                                />
                            </div>
                        </article>
                    </template>
                </AdminResourceSortableList>

                <button
                    type="button"
                    :aria-label="`Add new ${meta.label}`"
                    class="border-muted/70 hover:bg-muted/50 flex min-h-10 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors"
                    @click="edit()"
                >
                    <UIcon name="mingcute:add-line" class="text-muted" />
                </button>
            </UScrollArea>
        </template>
    </section>
</template>

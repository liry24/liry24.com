<script setup lang="ts">
import type { Entry } from 'liti'
import { createLitiClient } from 'liti/client'

import { LazyAdminFormEntryModal } from '#components'

const { open } = useAdminComposer()
const { data: permissions } = await useAdminPermissions()
const { data: models, status, error, refresh } = useLitiModels()
const route = useRoute()
const router = useRouter()
const modal = useOverlay().create(LazyAdminFormEntryModal)
const client = createLitiClient()

const sections = (['works', 'arts', 'careers', 'gameStats', 'skills', 'socials'] as const).map(
    (name) => {
        const model = computed(() => models.value[name])
        const query = computed(() =>
            String(route.query.model ?? 'posts') === name ? String(route.query.q ?? '') : '',
        )
        const source = useLitiQuery(name, {
            view: 'current',
            q: query,
            immediate: false,
        })
        watch(
            model,
            (available) => {
                if (available) void source.refresh()
            },
            { immediate: true },
        )
        const features = computed(
            () =>
                model.value?.features ?? {
                    publishing: false,
                    scheduling: false,
                    revisions: false,
                    sortable: false,
                },
        )
        const meta = computed(() => model.value?.meta ?? { label: name, plural: name, fields: [] })
        const moving = ref(false)
        const mutationError = ref('')
        const busy = computed(() => source.status.value === 'pending' || moving.value)
        const sortable = computed(() => features.value.sortable && !busy.value && !query.value)
        const display = (data: Record<string, unknown>) => {
            const fields = model.value?.displayFields
            const image = data[fields?.image ?? 'image']
            return {
                title: String(data[fields?.title ?? 'title'] ?? ''),
                image:
                    image && typeof image === 'object' && 'url' in image
                        ? String(image.url)
                        : undefined,
            }
        }
        async function reorder(entries: Entry[]) {
            if (busy.value) return
            moving.value = true
            mutationError.value = ''
            try {
                await client.setSortOrders(
                    name,
                    entries.map((entry, sortOrder) => ({
                        id: entry.id,
                        sortOrder,
                        expectedVersion: entry.version,
                    })),
                )
                await source.refresh()
            } catch (cause) {
                mutationError.value =
                    cause instanceof Error ? cause.message : 'Could not reorder entries.'
            } finally {
                moving.value = false
            }
        }
        async function edit(entry?: Entry) {
            const changed = await modal.open({
                modelName: name,
                id: entry?.id,
                categories: [
                    ...new Set(
                        source.data.value
                            .map((item) =>
                                'category' in item.data ? item.data.category : undefined,
                            )
                            .filter(
                                (value): value is string =>
                                    typeof value === 'string' && Boolean(value),
                            ),
                    ),
                ],
            }).result
            if (changed) await source.refresh()
        }
        function move(entry: Entry, offset: number) {
            const index = source.data.value.findIndex((item) => item.id === entry.id)
            const target = index + offset
            if (!sortable.value || index < 0 || target < 0 || target >= source.data.value.length)
                return
            const order = [...source.data.value]
            ;[order[index], order[target]] = [order[target]!, order[index]!]
            void reorder(order)
        }
        return reactive({
            name,
            ...source,
            meta,
            features,
            query,
            mutationError,
            busy,
            sortable,
            display,
            reorder,
            edit,
            move,
        })
    },
)
const visibleSections = computed(() => sections.filter((section) => models.value[section.name]))

const publication = (entry: Entry) =>
    entry.publishedRevisionId
        ? entry.currentRevisionId === entry.publishedRevisionId
            ? 'Published'
            : 'Unpublished changes'
        : 'Draft'

useHead({ title: 'Data' })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="data"
            :ui="{ root: 'h-full min-h-0', body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0' }"
        >
            <template #body>
                <div class="flex flex-col items-center gap-24 pt-[calc(30vh)]">
                    <div class="flex w-full flex-col items-center gap-8">
                        <AdminComposerPanel
                            v-if="permissions?.compose && !open"
                            class="mx-auto w-full max-w-xl"
                        />
                    </div>
                    <UContainer class="flex w-full min-w-0 flex-col gap-12 pt-12">
                        <UAlert
                            v-if="error"
                            :title="error.message"
                            color="error"
                            :actions="[{ label: 'Retry', onClick: () => refresh() }]"
                        />
                        <p
                            v-else-if="status === 'pending' && !visibleSections.length"
                            class="text-muted text-sm"
                        >
                            Loading models…
                        </p>
                        <section
                            :id="`model-${section.name}`"
                            v-for="section in visibleSections"
                            :key="section.name"
                            class="flex min-w-0 scroll-mt-6 flex-col gap-4"
                            :aria-label="section.meta.plural"
                            :data-model="section.name"
                        >
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="mr-auto text-sm">
                                    {{ section.meta.plural }}
                                    <span class="text-dimmed ml-1">{{ section.total }}</span>
                                </h2>
                                <UButton
                                    v-if="section.query"
                                    :label="`Clear search: ${section.query}`"
                                    variant="ghost"
                                    color="neutral"
                                    @click="
                                        router.replace({ query: { ...route.query, q: undefined } })
                                    "
                                />
                            </div>
                            <UAlert
                                v-if="section.error || section.mutationError"
                                :title="section.error?.message || section.mutationError"
                                color="error"
                            />
                            <USkeleton
                                v-if="
                                    !section.data.length &&
                                    (section.busy || section.status === 'idle')
                                "
                                class="h-32 w-full rounded-xl"
                            />
                            <template v-else>
                                <UScrollArea
                                    orientation="horizontal"
                                    class="w-full"
                                    :ui="{ viewport: 'gap-2' }"
                                >
                                    <AdminResourceSortableList
                                        :items="section.data"
                                        :disabled="!section.sortable"
                                        class="flex w-max shrink-0 gap-2"
                                        @reorder="section.reorder"
                                    >
                                        <template #default="{ item }">
                                            <article
                                                class="bg-muted/60 border-muted/30 hover:border-muted/60 flex h-full w-64 flex-col gap-3 rounded-xl border px-6 py-5 text-sm transition"
                                            >
                                                <div class="flex items-center gap-2">
                                                    <button
                                                        v-if="section.features.sortable"
                                                        type="button"
                                                        class="resource-drag-handle text-muted cursor-grab touch-none"
                                                        aria-label="Reorder (arrow keys move item)"
                                                        :disabled="!section.sortable"
                                                        @keydown.left.prevent="
                                                            section.move(item, -1)
                                                        "
                                                        @keydown.right.prevent="
                                                            section.move(item, 1)
                                                        "
                                                        @keydown.up.prevent="section.move(item, -1)"
                                                        @keydown.down.prevent="
                                                            section.move(item, 1)
                                                        "
                                                    >
                                                        <UIcon
                                                            name="mingcute:dot-grid-fill"
                                                            class="size-4"
                                                        />
                                                    </button>
                                                    <img
                                                        v-if="section.display(item.data).image"
                                                        :src="section.display(item.data).image"
                                                        alt=""
                                                        class="size-8 rounded-lg object-cover"
                                                    />
                                                    <UIcon
                                                        v-else-if="
                                                            'icon' in item.data &&
                                                            typeof item.data.icon === 'string' &&
                                                            item.data.icon
                                                        "
                                                        :name="item.data.icon"
                                                        class="size-5 shrink-0"
                                                    />
                                                    <button
                                                        type="button"
                                                        class="min-w-0 flex-1 truncate text-left hover:underline"
                                                        @click="section.edit(item)"
                                                    >
                                                        {{
                                                            section.display(item.data).title ||
                                                            item.id
                                                        }}
                                                    </button>
                                                </div>
                                                <p class="text-dimmed truncate text-xs">
                                                    {{ item.data.slug || item.id }}
                                                </p>
                                                <div
                                                    v-for="field in section.meta.fields"
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
                                                <div
                                                    class="mt-auto flex flex-wrap items-center gap-1"
                                                >
                                                    <UBadge
                                                        v-if="section.features.publishing"
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
                                                        :features="section.features"
                                                        :busy="section.busy"
                                                        :title="section.display(item.data).title"
                                                        @changed="section.refresh()"
                                                        class="ml-auto"
                                                        @edit="section.edit(item)"
                                                    />
                                                </div>
                                            </article>
                                        </template>
                                    </AdminResourceSortableList>

                                    <button
                                        type="button"
                                        :aria-label="`Add new ${section.meta.label}`"
                                        class="border-muted/70 hover:bg-muted/50 flex min-h-10 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors"
                                        @click="section.edit()"
                                    >
                                        <UIcon name="mingcute:add-line" class="text-muted" />
                                    </button>
                                </UScrollArea>
                            </template>
                        </section>

                        <AdminDataPosts v-if="models.posts" />
                    </UContainer>
                </div>
            </template>
        </UDashboardPanel>
    </div>
</template>

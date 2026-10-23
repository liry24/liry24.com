<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { Entry } from 'liti'

const route = useRoute()
const router = useRouter()
const section = useTemplateRef('section')

const query = computed(() =>
    String(route.query.model ?? 'posts') === 'posts' ? String(route.query.q ?? '') : '',
)
const page = ref(1)

const { data: models } = useLitiModels()
const { data, status, error, total, refresh } = useLitiQuery('posts', {
    view: 'current',
    q: query,
    page: () => ({ limit: 20, offset: (page.value - 1) * 20 }),
})

const model = computed(() => models.value['posts'])
const features = computed(
    () =>
        model.value?.features ?? {
            publishing: false,
            scheduling: false,
            revisions: false,
            sortable: false,
        },
)
const meta = computed(() => model.value?.meta ?? { label: 'post', plural: 'posts', fields: [] })
const busy = computed(() => status.value === 'pending')
const columns: TableColumn<Entry<'posts'>>[] = [
    { id: 'title', header: 'Title' },
    { id: 'status', header: 'Status' },
    {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
    },
    { id: 'actions', header: 'Actions' },
]

const edit = async (entry?: Entry<'posts'>) =>
    navigateTo(entry ? `/admin/posts/${encodeURIComponent(entry.id)}` : '/admin/posts/new')

function select(_event: Event, row: TableRow<Entry<'posts'>>) {
    void edit(row.original)
}
const search = useDebounceFn((value: string) => {
    void router.replace({ query: { ...route.query, model: 'posts', q: value || undefined } })
}, 250)

const publication = (entry: Entry) =>
    entry.publishedRevisionId
        ? entry.currentRevisionId === entry.publishedRevisionId
            ? 'Published'
            : 'Unpublished changes'
        : 'Draft'

watch(query, () => {
    page.value = 1
})
watch(
    [() => route.query.model, section],
    ([model, element]) => {
        if (model === 'posts') element?.scrollIntoView({ block: 'start' })
    },
    { flush: 'post' },
)
</script>

<template>
    <section
        id="model-posts"
        ref="section"
        class="flex min-w-0 scroll-mt-6 flex-col gap-4"
        :aria-label="meta.plural"
        data-model="posts"
    >
        <div class="flex flex-wrap items-center gap-2">
            <h2 class="mr-auto text-sm">
                {{ meta.plural }} <span class="text-dimmed ml-1">{{ total }}</span>
            </h2>
            <UInput
                :model-value="query"
                placeholder="Search posts"
                aria-label="Search posts"
                icon="mingcute:search-line"
                @update:model-value="search(String($event))"
            />
            <UButton label="New Post" icon="mingcute:add-line" @click="edit()" />
            <UButton
                label="Reload latest"
                variant="ghost"
                color="neutral"
                :disabled="busy"
                @click="refresh()"
            />
        </div>
        <UAlert v-if="error" :title="error.message" color="error" />
        <USkeleton
            v-if="!data.length && (busy || status === 'idle')"
            class="h-32 w-full rounded-xl"
        />
        <template v-else>
            <UTable :data :columns="columns" :loading="busy" class="w-full" @select="select">
                <template #title-cell="{ row }">
                    <NuxtLink
                        :to="`/admin/posts/${encodeURIComponent(row.original.id)}`"
                        class="text-highlighted block max-w-md truncate font-medium hover:underline"
                        >{{ row.original.data.title || row.original.id }}</NuxtLink
                    >
                </template>

                <template #status-cell="{ row }">
                    <div class="flex gap-2">
                        <UBadge
                            :label="publication(row.original)"
                            color="neutral"
                            variant="subtle"
                        />
                        <UBadge
                            v-if="row.original.scheduledAt"
                            label="Scheduled"
                            color="neutral"
                            variant="subtle"
                        />
                    </div>
                </template>

                <template #actions-cell="{ row }">
                    <AdminDataEntryActions
                        :entry="row.original"
                        :features
                        :busy
                        :title="row.original.data.title"
                        @changed="refresh()"
                        posts
                        @edit="edit(row.original)"
                    />
                </template>
                <template #empty><p class="text-muted py-8">No posts found.</p></template>
            </UTable>

            <UPagination
                v-if="total > 20"
                v-model:page="page"
                :total
                :items-per-page="20"
                :disabled="busy"
                aria-label="Post pages"
            />
        </template>
    </section>
</template>

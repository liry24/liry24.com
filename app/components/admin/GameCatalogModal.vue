<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
    items: Array<GameCatalogItem>
    meta: Record<string, GameCatalogMeta>
    statCounts: Record<string, number>
    finalFocus?: () => HTMLElement | null
}>()
const emit = defineEmits<{
    edit: [item: GameCatalogItem, trigger: HTMLElement | null]
    deleted: []
}>()

const toast = useToast()
const busyId = ref<string | null>(null)
const deleteError = ref('')
const failedImages = reactive(new Set<string>())

watch(open, (value) => {
    if (value) deleteError.value = ''
})

function imageSrc(item: GameCatalogItem): string | undefined {
    const src = mediaUrl(item.data.icon) || item.data.cover || undefined
    return src && !failedImages.has(src) ? src : undefined
}

function statsCount(id: string): number {
    return props.statCounts[id] ?? 0
}

function postsCount(id: string): number {
    return props.meta[id]?.postCount ?? 0
}

function isReferenced(id: string): boolean {
    return statsCount(id) > 0 || postsCount(id) > 0
}

function openSettings(event: MouseEvent, item: GameCatalogItem) {
    emit('edit', item, event.currentTarget as HTMLElement | null)
}

async function deleteGame(item: GameCatalogItem) {
    if (busyId.value) return
    busyId.value = item.id
    deleteError.value = ''
    try {
        await $fetch(`/api/admin/games/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
        toast.add({ title: `Removed ${item.data.name}`, color: 'neutral' })
        emit('deleted')
    } catch (error) {
        deleteError.value = adminErrorMessage(error, 'Could not remove game.')
    } finally {
        busyId.value = null
    }
}
</script>

<template>
    <UiFormDialog
        v-model:open="open"
        title="Manage games"
        :busy="Boolean(busyId)"
        wide
        hide-submit
        :final-focus="finalFocus"
    >
        <div class="grid gap-4">
            <p class="ui-description">
                Games are registered automatically when referenced in Game Stats or mentioned in
                posts. Customize icons, adjust metrics, or remove unused games here.
            </p>

            <UiAlert v-if="deleteError">
                {{ deleteError }}
            </UiAlert>

            <p v-if="!items.length" class="ui-description py-4 text-center">
                No registered games yet.
            </p>

            <ul v-else class="grid gap-2" role="list">
                <li
                    v-for="item in items"
                    :key="item.id"
                    :data-catalog-game-id="item.id"
                    class="ui-card flex flex-wrap items-center justify-between gap-3 p-3"
                >
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                        <img
                            v-if="imageSrc(item)"
                            :src="imageSrc(item)"
                            alt=""
                            loading="lazy"
                            decoding="async"
                            class="size-9 shrink-0 rounded object-cover"
                            @error="failedImages.add(imageSrc(item) ?? '')"
                        />
                        <span
                            v-else
                            class="bg-elevated text-muted flex size-9 shrink-0 items-center justify-center rounded"
                            aria-hidden="true"
                        >
                            <Icon name="mingcute:game-2-fill" class="size-5" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-medium">{{ item.data.name }}</p>
                            <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                                <span class="text-muted font-mono">{{ item.data.slug }}</span>
                                <UBadge
                                    v-if="statsCount(item.id) > 0"
                                    variant="soft"
                                    color="success"
                                    size="sm"
                                >
                                    {{ statsCount(item.id) }}
                                    {{ statsCount(item.id) === 1 ? 'stat' : 'stats' }}
                                </UBadge>
                                <UBadge
                                    v-if="postsCount(item.id) > 0"
                                    variant="soft"
                                    color="neutral"
                                    size="sm"
                                >
                                    {{ postsCount(item.id) }}
                                    {{ postsCount(item.id) === 1 ? 'post' : 'posts' }}
                                </UBadge>
                                <span v-if="!isReferenced(item.id)" class="text-muted">Unused</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <UiButton
                            type="button"
                            :disabled="Boolean(busyId)"
                            @click="openSettings($event, item)"
                        >
                            Settings
                        </UiButton>
                        <UiButton
                            type="button"
                            variant="ghost"
                            color="error"
                            :disabled="Boolean(busyId) || isReferenced(item.id)"
                            :title="
                                isReferenced(item.id)
                                    ? 'Remove referencing stats and post mentions before deleting.'
                                    : undefined
                            "
                            @click="deleteGame(item)"
                        >
                            {{ busyId === item.id ? 'Removing…' : 'Remove' }}
                        </UiButton>
                    </div>
                </li>
            </ul>
        </div>
    </UiFormDialog>
</template>

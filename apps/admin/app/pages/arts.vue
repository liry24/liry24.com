<script setup lang="ts">
const { arts, changed, fetchArts, reorderArts, deleteArt, modalArt } = useArt()

defineShortcuts({
    n: () => {
        modalArt.open()
    },
})
</script>

<template>
    <div class="px-6">
        <UDashboardPanel id="arts" resizable>
            <template #header>
                <UDashboardNavbar title="Arts" icon="mingcute:pic-fill">
                    <template #trailing>
                        <span class="text-muted ml-2 text-sm"> {{ arts?.length || 0 }} Arts </span>

                        <UButton
                            loading-auto
                            icon="mingcute:refresh-2-line"
                            variant="ghost"
                            size="sm"
                            @click="fetchArts()"
                        />
                    </template>

                    <template #right>
                        <UButton
                            v-if="changed"
                            loading-auto
                            icon="mingcute:check-line"
                            label="Save"
                            color="neutral"
                            @click="reorderArts"
                        />

                        <AdminModalArt @success="fetchArts()">
                            <UButton
                                icon="mingcute:add-line"
                                label="New Art"
                                variant="outline"
                                color="neutral"
                                :ui="{ leadingIcon: 'size-4.5' }"
                            >
                                <template #trailing>
                                    <UKbd value="n" />
                                </template>
                            </UButton>
                        </AdminModalArt>
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <UScrollArea class="h-[calc(100dvh-var(--ui-header-height))] p-6">
                    <ReorderGroup v-model:values="arts" axis="y" class="grid gap-2">
                        <ReorderItem v-for="art in arts" :key="art.slug" :value="art">
                            <div
                                class="bg-muted/50 ring-muted flex cursor-grab items-center gap-3 rounded-lg p-4 ring select-none"
                            >
                                <Icon name="mingcute:dot-grid-fill" size="20" />

                                <template v-if="art.images.length">
                                    <NuxtImg
                                        :src="art.images[0]?.src"
                                        :alt="art.images[0]?.alt"
                                        class="size-12 rounded-lg object-cover"
                                    />
                                </template>

                                <span class="text-sm leading-none">{{ art.title }}</span>
                                <span class="text-muted text-sm leading-none">{{ art.slug }}</span>
                                <span class="text-sm leading-none">{{ art.href }}</span>

                                <div class="ml-auto flex items-center">
                                    <UButton
                                        aria-label="Edit"
                                        icon="mingcute:edit-3-fill"
                                        variant="ghost"
                                        size="sm"
                                        @click="modalArt.open({ data: art })"
                                    />

                                    <UButton
                                        aria-label="Delete"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="deleteArt(art.slug)"
                                    />
                                </div>
                            </div>
                        </ReorderItem>
                    </ReorderGroup>
                </UScrollArea>
            </template>
        </UDashboardPanel>
    </div>
</template>

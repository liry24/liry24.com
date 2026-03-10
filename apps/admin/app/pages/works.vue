<script setup lang="ts">
const { works, changed, fetchWorks, reorderWorks, deleteWork, modalWork } = useWork()

defineShortcuts({
    n: () => {
        modalWork.open()
    },
})
</script>

<template>
    <div class="px-6">
        <UDashboardPanel id="works" resizable>
            <template #header>
                <UDashboardNavbar title="Works" icon="mingcute:package-2-fill">
                    <template #trailing>
                        <span class="text-muted ml-2 text-sm">
                            {{ works?.length || 0 }} Works
                        </span>

                        <UButton
                            loading-auto
                            aria-label="Refresh"
                            icon="mingcute:refresh-2-line"
                            variant="ghost"
                            size="sm"
                            @click="fetchWorks()"
                        />
                    </template>

                    <template #right>
                        <UButton
                            v-if="changed"
                            loading-auto
                            icon="mingcute:check-line"
                            label="Save"
                            color="neutral"
                            @click="reorderWorks()"
                        />

                        <AdminModalWork @success="fetchWorks()">
                            <UButton
                                icon="mingcute:add-line"
                                label="New Work"
                                variant="outline"
                                color="neutral"
                                :ui="{ leadingIcon: 'size-4.5' }"
                            >
                                <template #trailing>
                                    <UKbd value="n" />
                                </template>
                            </UButton>
                        </AdminModalWork>
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <UScrollArea class="h-[calc(100dvh-var(--ui-header-height))] p-6">
                    <ReorderGroup v-model:values="works" axis="y" class="grid gap-2">
                        <ReorderItem v-for="work in works" :key="work.slug" :value="work">
                            <div
                                class="bg-muted/50 ring-muted flex cursor-grab items-center gap-3 rounded-lg p-4 ring select-none"
                            >
                                <Icon name="mingcute:dot-grid-fill" size="20" />

                                <NuxtImg
                                    v-if="work.image"
                                    :src="work.image"
                                    alt=""
                                    class="size-12 rounded-lg object-cover"
                                />

                                <span class="text-sm leading-none">{{ work.title }}</span>
                                <span class="text-muted text-sm leading-none">{{ work.slug }}</span>

                                <div class="ml-auto flex items-center">
                                    <UButton
                                        aria-label="Edit"
                                        icon="mingcute:edit-3-fill"
                                        variant="ghost"
                                        size="sm"
                                        @click="modalWork.open({ data: work })"
                                    />

                                    <UButton
                                        aria-label="Delete"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="deleteWork(work.slug)"
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

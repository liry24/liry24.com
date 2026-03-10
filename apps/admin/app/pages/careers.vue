<script setup lang="ts">
const { careers, changed, fetchCareers, reorderCareers, deleteCareer, modalCareer } = useCareer()

defineShortcuts({
    n: () => {
        modalCareer.open()
    },
})
</script>

<template>
    <div class="px-6">
        <UDashboardPanel id="careers" resizable>
            <template #header>
                <UDashboardNavbar title="Careers" icon="mingcute:suitcase-fill">
                    <template #trailing>
                        <span class="text-muted ml-2 text-sm">
                            {{ careers?.length || 0 }} Careers
                        </span>

                        <UButton
                            loading-auto
                            aria-label="Refresh"
                            icon="mingcute:refresh-2-line"
                            variant="ghost"
                            size="sm"
                            @click="fetchCareers()"
                        />
                    </template>

                    <template #right>
                        <UButton
                            v-if="changed"
                            loading-auto
                            icon="mingcute:check-line"
                            label="Save"
                            color="neutral"
                            @click="reorderCareers"
                        />

                        <AdminModalCareer @success="fetchCareers">
                            <UButton
                                icon="mingcute:add-line"
                                label="New Career"
                                variant="outline"
                                color="neutral"
                                :ui="{ leadingIcon: 'size-4.5' }"
                            >
                                <template #trailing>
                                    <UKbd value="n" />
                                </template>
                            </UButton>
                        </AdminModalCareer>
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <UScrollArea class="h-[calc(100dvh-var(--ui-header-height))] p-6">
                    <ReorderGroup v-model:values="careers" axis="y" class="grid gap-2">
                        <ReorderItem v-for="career in careers" :key="career.id" :value="career">
                            <div
                                class="bg-muted/50 ring-muted flex cursor-grab items-center gap-3 rounded-lg p-4 ring select-none"
                            >
                                <Icon name="mingcute:dot-grid-fill" size="20" />

                                <span class="text-sm leading-none">{{ career.period }}</span>
                                <span class="text-muted text-sm leading-none">{{
                                    career.position
                                }}</span>
                                <span class="text-sm leading-none">{{ career.company }}</span>

                                <div class="ml-auto flex items-center">
                                    <UButton
                                        aria-label="Edit"
                                        icon="mingcute:edit-3-fill"
                                        variant="ghost"
                                        size="sm"
                                        @click="modalCareer.open({ data: career })"
                                    />

                                    <UButton
                                        aria-label="Delete"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="deleteCareer(career.id)"
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

<script setup lang="ts">
const { ranks, changed, fetchRanks, reorderRanks, deleteRank, modalRank } = useRank()

defineShortcuts({
    n: () => {
        modalRank.open()
    },
})
</script>

<template>
    <div class="px-6">
        <UDashboardPanel id="ranks" resizable>
            <template #header>
                <UDashboardNavbar title="Ranks" icon="mingcute:chess-fill">
                    <template #trailing>
                        <span class="text-muted ml-2 text-sm">
                            {{ ranks?.length || 0 }} Ranks
                        </span>

                        <UButton
                            loading-auto
                            aria-label="Refresh"
                            icon="mingcute:refresh-2-line"
                            variant="ghost"
                            size="sm"
                            @click="fetchRanks()"
                        />
                    </template>

                    <template #right>
                        <UButton
                            v-if="changed"
                            loading-auto
                            icon="mingcute:check-line"
                            label="Save"
                            color="neutral"
                            @click="reorderRanks"
                        />

                        <AdminModalRank @success="fetchRanks">
                            <UButton
                                icon="mingcute:add-line"
                                label="New Rank"
                                variant="outline"
                                color="neutral"
                                :ui="{ leadingIcon: 'size-4.5' }"
                            >
                                <template #trailing>
                                    <UKbd value="n" />
                                </template>
                            </UButton>
                        </AdminModalRank>
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <UScrollArea class="h-[calc(100dvh-var(--ui-header-height))] p-6">
                    <ReorderGroup v-model:values="ranks" axis="y" class="grid gap-2">
                        <ReorderItem v-for="rank in ranks" :key="rank.id" :value="rank">
                            <div
                                class="bg-muted/50 ring-muted flex cursor-grab items-center gap-3 rounded-lg p-4 ring select-none"
                            >
                                <Icon name="mingcute:dot-grid-fill" size="20" />

                                <span class="text-sm leading-none">{{ rank.game }}</span>
                                <span class="text-muted text-sm leading-none">
                                    {{ rank.season }}
                                </span>
                                <span class="text-sm leading-none">{{ rank.rank }}</span>
                                <NuxtImg :src="rank.imageUrl" class="h-8" />

                                <div class="ml-auto flex items-center">
                                    <UButton
                                        aria-label="Edit"
                                        icon="mingcute:edit-3-fill"
                                        variant="ghost"
                                        size="sm"
                                        @click="modalRank.open({ data: rank })"
                                    />

                                    <UButton
                                        aria-label="Delete"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="deleteRank(rank.id)"
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

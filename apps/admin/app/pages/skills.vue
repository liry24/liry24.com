<script setup lang="ts">
const { skills, changed, categories, fetchSkills, reorderSkills, deleteSkill, modalSkill } =
    useSkill()

defineShortcuts({
    n: () => {
        modalSkill.open({ categories: categories.value })
    },
})
</script>

<template>
    <div class="px-6">
        <UDashboardPanel id="skills" resizable>
            <template #header>
                <UDashboardNavbar title="Skills" icon="mingcute:award-fill">
                    <template #trailing>
                        <span class="text-muted ml-2 text-sm">
                            {{ skills?.length || 0 }} Skills
                        </span>

                        <UButton
                            loading-auto
                            aria-label="Refresh"
                            icon="mingcute:refresh-2-line"
                            variant="ghost"
                            size="sm"
                            @click="fetchSkills()"
                        />
                    </template>

                    <template #right>
                        <UButton
                            v-if="changed"
                            loading-auto
                            icon="mingcute:check-line"
                            label="Save"
                            color="neutral"
                            @click="reorderSkills"
                        />

                        <AdminModalSkill :categories @success="fetchSkills">
                            <UButton
                                icon="mingcute:add-line"
                                label="New Skill"
                                variant="outline"
                                color="neutral"
                                :ui="{ leadingIcon: 'size-4.5' }"
                            >
                                <template #trailing>
                                    <UKbd value="n" />
                                </template>
                            </UButton>
                        </AdminModalSkill>
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <UScrollArea class="h-[calc(100dvh-var(--ui-header-height))] p-6">
                    <ReorderGroup v-model:values="skills" axis="y" class="grid gap-2">
                        <ReorderItem v-for="skill in skills" :key="skill.id" :value="skill">
                            <div
                                class="bg-muted/50 ring-muted flex cursor-grab items-center gap-3 rounded-lg p-4 ring select-none"
                            >
                                <Icon name="mingcute:dot-grid-fill" size="20" />

                                <Icon :name="skill.icon" size="20" />

                                <span class="text-sm leading-none">{{ skill.name }}</span>
                                <span class="text-muted text-sm leading-none">
                                    {{ skill.category }}
                                </span>

                                <div class="ml-auto flex items-center">
                                    <UButton
                                        aria-label="Edit"
                                        icon="mingcute:edit-3-fill"
                                        variant="ghost"
                                        size="sm"
                                        @click="modalSkill.open({ data: skill, categories })"
                                    />

                                    <UButton
                                        aria-label="Delete"
                                        icon="mingcute:close-line"
                                        variant="ghost"
                                        size="sm"
                                        @click="deleteSkill(skill.id)"
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

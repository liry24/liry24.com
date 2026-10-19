<script setup lang="ts">
const data = ref([
    {
        name: 'Liry24',
        id: 'liry24',
        email: 'liry24@example.com',
        date: '2024-03-11T15:30:00',
    },
])

useHead({ title: 'Users' })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="users"
            :ui="{
                root: 'h-full min-h-0',
                body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0',
            }"
        >
            <template #body>
                <div class="flex w-full flex-col items-center gap-24">
                    <UTable
                        :data
                        class="w-full flex-1"
                        :ui="{ tr: 'cursor-pointer hover:bg-muted/60' }"
                    />
                </div>
            </template>
        </UDashboardPanel>
    </div>
</template>

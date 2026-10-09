<script setup lang="ts">
const props = defineProps<{ title: string; icon?: string; count?: number }>()
useHead(() => ({ title: props.title }))
</script>

<template>
    <div class="h-full min-w-0 lg:px-6">
        <UDashboardPanel
            :id="title.toLowerCase()"
            :ui="{ root: 'h-full min-h-0', body: 'gap-4 p-4 sm:gap-4 sm:p-6 [&>*]:shrink-0' }"
        >
            <template #header>
                <UDashboardNavbar :title :icon>
                    <template #trailing>
                        <span
                            v-if="count !== undefined"
                            class="text-muted ml-2 hidden text-sm sm:inline"
                            >{{ count }} {{ title }}</span
                        >
                        <slot name="trailing" />
                    </template>
                    <template #right><slot name="actions" /></template>
                </UDashboardNavbar>
            </template>
            <template #body><slot /></template>
        </UDashboardPanel>
    </div>
</template>

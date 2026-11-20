<script setup lang="ts">
const props = defineProps<{ title: string; icon?: string; count?: number }>()
useHead(() => ({ title: props.title }))
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            :id="title.toLowerCase()"
            :ui="{
                root: 'h-full min-h-0',
                body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0',
            }"
        >
            <template #header>
                <UDashboardNavbar
                    :title
                    :icon
                    :ui="{
                        root: 'max-lg:h-auto max-lg:min-h-(--ui-header-height) max-lg:flex-wrap max-lg:py-2',
                        right: 'max-lg:max-w-full max-lg:flex-wrap',
                        toggle: 'shrink-0',
                    }"
                >
                    <template #trailing>
                        <slot name="trailing" />
                    </template>
                    <template #right>
                        <slot name="actions" />
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <slot />
            </template>
        </UDashboardPanel>
    </div>
</template>

<script setup lang="ts">
useHead({ title: 'Liry24 Admin', titleTemplate: '%s' })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="home"
            :ui="{
                root: 'h-full min-h-0',
                body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0',
            }"
        >
            <template #body>
                <div class="flex flex-col items-center gap-24"></div>
            </template>
        </UDashboardPanel>
    </div>
</template>

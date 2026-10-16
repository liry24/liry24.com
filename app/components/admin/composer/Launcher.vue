<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
const { open, busy } = useAdminComposer()
defineShortcuts({
    meta_k: {
        usingInput: true,
        handler: () => {
            if (!busy.value) open.value = !open.value
        },
    },
})
</script>

<template>
    <UButton
        :label="collapsed ? undefined : 'Compose'"
        aria-label="Compose content"
        icon="mingcute:sparkles-line"
        color="neutral"
        variant="soft"
        class="mb-3 justify-center"
        :disabled="busy"
        @click="open = true"
    >
        <template v-if="!collapsed" #trailing><UKbd value="meta" /><UKbd value="k" /></template>
    </UButton>
    <UModal
        v-model:open="open"
        :dismissible="!busy"
        :close="!busy"
        title="Compose content"
        :ui="{ content: 'sm:max-w-3xl', body: 'bg-elevated/40' }"
    >
        <template #content>
            <div class="p-6"><AdminComposerPanel v-if="open" /></div>
        </template>
    </UModal>
</template>

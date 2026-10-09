<script setup lang="ts">
defineProps<{ sortable?: boolean }>()
defineEmits<{ up: []; down: [] }>()
</script>

<template>
    <div
        class="bg-muted/50 ring-muted flex flex-wrap items-start gap-3 rounded-lg p-4 ring sm:flex-nowrap sm:items-center"
    >
        <button
            v-if="sortable"
            type="button"
            class="resource-drag-handle text-muted cursor-grab touch-none self-center"
            aria-label="Reorder (arrow keys move item)"
            @keydown.up.prevent="$emit('up')"
            @keydown.down.prevent="$emit('down')"
        >
            <UIcon name="mingcute:dot-grid-fill" class="size-5" />
        </button>
        <slot name="leading" />
        <div class="order-last w-full min-w-0 sm:order-0 sm:w-auto sm:flex-1"><slot /></div>
        <div class="ml-auto flex items-center"><slot name="actions" /></div>
    </div>
</template>

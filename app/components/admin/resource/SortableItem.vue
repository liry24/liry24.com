<script setup lang="ts">
defineProps<{ sortable?: boolean }>()
defineEmits<{ up: []; down: [] }>()
</script>

<template>
    <div class="ring-default flex items-center gap-3 rounded-xl p-4 ring">
        <button
            v-if="sortable"
            class="resource-drag-handle cursor-grab touch-none"
            aria-label="Reorder (arrow keys move item)"
            @keydown.up.prevent="$emit('up')"
            @keydown.down.prevent="$emit('down')"
        >
            <UIcon name="mingcute:dots-line" />
        </button>
        <div class="min-w-0 flex-1"><slot /></div>
        <slot name="actions" />
    </div>
</template>

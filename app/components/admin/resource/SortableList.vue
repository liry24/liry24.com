<script setup lang="ts" generic="T extends { id: string }">
import { updateConfig } from '@formkit/drag-and-drop'
import { dragAndDrop } from '@formkit/drag-and-drop/vue'
const items = defineModel<T[]>({ required: true })
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ reorder: [items: T[]] }>()
const parent = ref<HTMLElement>()
dragAndDrop({
    parent,
    values: items,
    dragHandle: '.resource-drag-handle',
    disabled: props.disabled,
    onDragend: () => emit('reorder', items.value),
})
watch(
    () => props.disabled,
    (disabled) => {
        if (parent.value) updateConfig(parent.value, { disabled })
    },
)
</script>

<template>
    <ul ref="parent" class="grid min-w-0 grid-cols-1 gap-2">
        <li v-for="item in items" :key="item.id" class="min-w-0"><slot :item /></li>
    </ul>
</template>

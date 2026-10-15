<script setup lang="ts" generic="T extends { id: string }">
import { updateConfig } from '@formkit/drag-and-drop'
import { dragAndDrop } from '@formkit/drag-and-drop/vue'

const props = defineProps<{ items: T[]; disabled?: boolean }>()
const values = shallowRef<T[]>([...props.items])
watch(
    () => props.items,
    (items) => {
        values.value = [...items]
    },
)
const emit = defineEmits<{ reorder: [items: T[]] }>()
const parent = ref<HTMLElement>()

dragAndDrop({
    parent,
    values,
    dragHandle: '.resource-drag-handle',
    disabled: props.disabled,
    onDragend: () => emit('reorder', values.value),
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
        <li v-for="item in values" :key="item.id" class="min-w-0"><slot :item /></li>
    </ul>
</template>

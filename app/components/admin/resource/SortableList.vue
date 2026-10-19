<script setup lang="ts" generic="T extends { id: string }">
import { updateConfig } from '@formkit/drag-and-drop'
import { dragAndDrop } from '@formkit/drag-and-drop/vue'

const { items, disabled } = defineProps<{ items: T[]; disabled?: boolean }>()
const values = shallowRef<T[]>([...items])

const emit = defineEmits<{ reorder: [items: T[]] }>()
const parent = ref<HTMLElement>()

watch(
    () => items,
    (items) => {
        values.value = [...items]
    },
)
dragAndDrop({
    parent,
    values,
    dragHandle: '.resource-drag-handle',
    disabled: disabled,
    onDragend: () => emit('reorder', values.value),
})
watch(
    () => disabled,
    (disabled) => {
        if (parent.value) updateConfig(parent.value, { disabled })
    },
)
</script>

<template>
    <ul ref="parent" class="min-w-0 gap-2">
        <li v-for="item in values" :key="item.id" class="min-w-0"><slot :item /></li>
    </ul>
</template>

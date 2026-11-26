<script setup lang="ts">
import type { Figure } from '@lucasmarkes/hairline'

const { kind, label } = defineProps<{
    kind: 'drawer' | 'riffle'
    label?: string
}>()

const element = useTemplateRef<HTMLDivElement>('element')
let instance: Figure | undefined
let disposed = false

onMounted(async () => {
    const hairline = await import('@lucasmarkes/hairline')
    if (disposed || !element.value) return

    const create = kind === 'drawer' ? hairline.drawer : hairline.riffle
    instance = create(element.value, { intensity: 0.5, play: true, theme: 'auto', label })
})

onBeforeUnmount(() => {
    disposed = true
    instance?.destroy()
})
</script>

<template>
    <div ref="element" class="aspect-5/4 w-full" />
</template>

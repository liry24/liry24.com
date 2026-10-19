<script setup lang="ts">
import type { Figure } from '@lucasmarkes/hairline'

interface Props {
    intensity?: number
    play?: boolean
}
const { intensity = 0.5, play = true } = defineProps<Props>()

const element = ref<HTMLElement | null>(null)
let instance: Figure | undefined
let disposed = false

onMounted(async () => {
    const { riffle } = await import('@lucasmarkes/hairline')

    if (disposed || !element.value) return

    instance = riffle(element.value, {
        intensity,
        play,
    })
})

watch(
    () => [intensity, play] as const,
    ([newIntensity, newPlay]) => {
        instance?.update({
            intensity: newIntensity,
            play: newPlay,
        })
    },
)

onBeforeUnmount(() => {
    disposed = true
    instance?.destroy()
})
</script>

<template>
    <div ref="element" class="w-full" />
</template>

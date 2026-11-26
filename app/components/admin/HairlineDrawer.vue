<script setup lang="ts">
import type { Figure, HairlineOptions } from '@lucasmarkes/hairline'

interface Props {
    intensity?: number
    play?: boolean
    theme?: HairlineOptions['theme']
    label?: string
}
const { intensity = 0.5, play = true, theme = 'auto', label } = defineProps<Props>()

const element = ref<HTMLElement | null>(null)
let instance: Figure | undefined
let disposed = false

onMounted(async () => {
    const { drawer } = await import('@lucasmarkes/hairline')

    if (disposed || !element.value) return

    instance = drawer(element.value, {
        intensity,
        play,
        theme,
        label,
    })
})

watch(
    () => [intensity, play, theme, label] as const,
    ([newIntensity, newPlay, newTheme, newLabel]) => {
        instance?.update({
            intensity: newIntensity,
            play: newPlay,
            theme: newTheme,
            label: newLabel,
        })
    },
)

onBeforeUnmount(() => {
    disposed = true
    instance?.destroy()
})
</script>

<template>
    <div ref="element" class="aspect-5/4 w-full" />
</template>

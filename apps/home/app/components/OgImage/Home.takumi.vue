<script setup lang="ts">
interface Props {
    title?: string
}
const { title = 'title' } = defineProps<Props>()
</script>

<template>
    <div
        class="flex size-full flex-col items-center justify-center gap-16 bg-black font-[Special_Gothic_Expanded_One]"
    >
        <h1 class="pt-8 text-9xl tracking-tight text-white">
            {{ title }}
        </h1>
        <p class="text-2xl text-zinc-400">liry24.com</p>
    </div>
</template>

<script setup lang="ts">
interface Props {
    title?: string
    subpath?: string
}
const { title = 'title', subpath } = defineProps<Props>()
</script>

<template>
    <div
        class="flex size-full flex-col items-center justify-center gap-16 bg-black font-[Special_Gothic_Expanded_One]"
    >
        <div v-if="subpath" class="flex items-center pt-8 text-[112px] tracking-tight text-white">
            <h1>
                {{ title }}
            </h1>
            <h2 class="font-[Geist_Mono] font-light tracking-[-0.07em] text-zinc-300">
                <span class="mr-8 tracking-[-0.3em]">//</span>{{ subpath }}
            </h2>
        </div>
        <h1 v-else class="pt-8 text-9xl tracking-tight text-white">
            {{ title }}
        </h1>

        <p class="text-2xl text-zinc-400">liry24.com</p>
    </div>
</template>

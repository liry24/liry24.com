<script setup lang="ts">
interface Props {
    title?: string
    description?: string
    date?: string
    tags?: Array<string>
    cover?: string
}

const { title = 'Post', description, date, tags, cover } = defineProps<Props>()

const titleSize = computed(() => {
    if (title.length <= 24) return 'text-[64px]'
    if (title.length <= 48) return 'text-[52px]'
    return 'text-[42px]'
})

const clippedDescription = computed(() => {
    const characters = Array.from(description?.trim() ?? '')
    if (characters.length <= 110) return characters.join('')
    return `${characters.slice(0, 109).join('').trimEnd()}…`
})
</script>

<template>
    <div
        class="relative flex size-full flex-col justify-between overflow-hidden bg-black p-14 text-white"
        style="font-family: 'Noto Sans JP', 'Inter', sans-serif"
    >
        <img
            v-if="cover"
            :src="cover"
            alt=""
            class="absolute inset-0 size-full object-cover opacity-30"
        />
        <div
            v-if="cover"
            class="absolute inset-0 size-full"
            style="
                background: linear-gradient(
                    135deg,
                    rgba(0, 0, 0, 0.92) 0%,
                    rgba(0, 0, 0, 0.72) 55%,
                    rgba(0, 0, 0, 0.94) 100%
                );
            "
        />

        <div class="relative flex items-center justify-between">
            <div class="flex items-center gap-4">
                <span
                    class="text-4xl tracking-tight text-white"
                    style="font-family: 'Special Gothic Expanded One'"
                >
                    Liry24
                </span>
                <span class="font-mono text-3xl font-light text-zinc-400">// posts</span>
            </div>
            <span v-if="date" class="font-mono text-2xl text-zinc-400">{{ date }}</span>
        </div>

        <div class="relative flex flex-col gap-5">
            <h1 :class="titleSize" class="leading-[1.2] font-bold tracking-tight text-white">
                {{ title }}
            </h1>
            <p v-if="description" class="text-[26px] leading-[1.5] text-zinc-300">
                {{ clippedDescription }}
            </p>
        </div>

        <div class="relative flex items-center justify-between border-t border-zinc-800 pt-6">
            <div class="flex gap-3">
                <span
                    v-for="(tag, index) in tags?.slice(0, 3)"
                    :key="index"
                    class="rounded-full bg-zinc-900 px-4 py-2 font-mono text-xl text-zinc-300"
                >
                    #{{ tag }}
                </span>
            </div>
            <span class="font-mono text-2xl text-zinc-400">liry24.com</span>
        </div>
    </div>
</template>

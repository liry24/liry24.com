<script setup lang="ts">
const { slug } = defineProps<{ slug: string }>()

const fallback = computed(() => '<game:' + slug + '>')
const { data } = await useLitiQuery('games')
const game = computed(() => data.value?.find((entry) => entry.data.slug === slug)?.data)
</script>

<template>
    <NuxtLink
        v-if="game"
        :to="`/posts?game=${encodeURIComponent(game.slug)}`"
        class="bg-muted hover:bg-accented inline-flex max-w-full items-baseline gap-[0.2em] rounded-md pr-[0.55rem] pl-[0.4rem] align-baseline leading-[inherit] no-underline transition [text-box:trim-both_cap_alphabetic]"
    >
        <img
            v-if="gameImageUrl(game.icon) || game.cover"
            :src="gameImageUrl(game.icon) || game.cover || undefined"
            alt=""
            class="relative top-[0.13em] inline-block size-[1em] shrink-0 rounded-sm object-cover"
        />
        <span class="">{{ game.name }}</span>
    </NuxtLink>

    <span v-else>{{ fallback }}</span>
</template>

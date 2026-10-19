<script setup lang="ts">
import { gameImageUrl } from '~~/shared/utils/games'
const props = defineProps<{ slug: string }>()
const fallback = computed(() => '<game:' + props.slug + '>')
const { data } = await useContent('games')
const game = computed(() => data.value?.find((entry) => entry.data.slug === props.slug)?.data)
</script>
<template>
    <NuxtLink
        v-if="game"
        :to="`/posts?game=${encodeURIComponent(game.slug)}`"
        class="bg-muted hover:bg-accented inline-flex max-w-full items-baseline gap-[0.25em] rounded px-[0.25em] align-baseline leading-[inherit] font-medium no-underline"
    >
        <img
            v-if="gameImageUrl(game.icon) || game.cover"
            :src="gameImageUrl(game.icon) || game.cover || undefined"
            alt=""
            class="relative top-[0.12em] inline-block size-[1em] shrink-0 rounded-sm object-cover"
        />
        <span>{{ game.name }}</span>
    </NuxtLink>
    <span v-else>{{ fallback }}</span>
</template>

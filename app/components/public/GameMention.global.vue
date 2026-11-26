<script setup lang="ts">
const { slug } = defineProps<{ slug: string }>()

const previewGames = inject(postPreviewGamesKey, null)
const published = previewGames
    ? null
    : await useFetch<GameMentionData | null>(
          () => `/api/posts/game-mentions/${encodeURIComponent(slug)}`,
      )
const game = computed(() => published?.data.value)
const gameImageSrc = computed(() => mediaUrl(game.value?.icon) || game.value?.cover || undefined)
const previewGame = computed(() => previewGames?.get(slug))
</script>

<template>
    <NuxtLink
        v-if="game"
        :to="`/posts?game=${encodeURIComponent(game.slug)}`"
        class="bg-muted hover:bg-accented inline-flex max-w-full items-baseline gap-[0.2em] rounded-md pr-[0.55rem] pl-[0.4rem] align-baseline leading-[inherit] no-underline transition [text-box:trim-both_cap_alphabetic]"
    >
        <img
            v-if="gameImageSrc"
            :src="gameImageSrc"
            alt=""
            class="relative top-[0.13em] inline-block size-[1em] shrink-0 rounded-sm object-cover"
        />
        <span>{{ game.name }}</span>
    </NuxtLink>

    <span v-else class="bg-muted inline-flex max-w-full items-baseline gap-1 rounded-md px-2">
        <img
            v-if="previewGame?.cover"
            :src="previewGame.cover"
            alt=""
            class="relative top-[0.13em] inline-block size-[1em] shrink-0 rounded-sm object-cover"
        />
        {{ previewGame?.name ?? slug }}
    </span>
</template>

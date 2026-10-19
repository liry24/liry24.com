<script setup lang="ts">
const emit = defineEmits<{ select: [game: GameSearchResult] }>()

const query = ref('')
const { games, warning, importing, loading, importGame } = useGameSearch(() => query.value)

const select = async (game: GameSearchResult) => {
    const saved = await importGame(game)
    if (saved) emit('select', saved)
}
</script>

<template>
    <div class="grid gap-2">
        <UInput
            v-model="query"
            :loading
            aria-label="Search IGDB games"
            placeholder="Search games…"
            class="w-full"
        />
        <p v-if="warning" role="status" class="text-muted text-sm">{{ warning }}</p>
        <UButton
            v-for="game in games"
            :key="game.igdbId"
            :label="game.name"
            variant="ghost"
            :disabled="importing"
            @click="select(game)"
        />
        <NuxtLink
            to="https://www.igdb.com"
            target="_blank"
            rel="noopener"
            class="text-muted text-xs"
            >Game data by IGDB</NuxtLink
        >
    </div>
</template>

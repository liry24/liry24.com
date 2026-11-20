<script setup lang="ts">
const { title, to } = defineProps<{ title: string; to?: string }>()

const parts = computed(() => gameTitleParts(title))
const onlyMentions = computed(() => parts.value.every((part) => part.slug || !part.text.trim()))
</script>

<template>
    <template v-for="(part, index) in parts" :key="index">
        <GameMention v-if="part.slug" :slug="part.slug" />
        <NuxtLink v-else-if="to" :to>{{ part.text }}</NuxtLink>
        <template v-else>{{ part.text }}</template>
    </template>

    <NuxtLink v-if="to && onlyMentions" :to class="ml-2 inline-flex" aria-label="Open article">
        <UIcon name="mingcute:arrow-right-up-line" />
    </NuxtLink>
</template>

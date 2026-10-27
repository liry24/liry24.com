<script setup lang="ts">
useSeoMeta({ title: 'Posts', description: 'Blog posts by Liry24.' })
defineOgImage('Home.takumi', { title: 'Liry24', subpath: 'posts' }, [
    { key: 'og' },
    { key: 'whatsapp', width: 800, height: 800 },
])
const route = useRoute()
const page = ref(1)
const { data, error } = await useFetch<PostCardsPage>('/api/posts/cards', {
    query: computed(() => ({
        game: typeof route.query.game === 'string' ? route.query.game : undefined,
        limit: 20,
        offset: (page.value - 1) * 20,
    })),
})
if (error.value) throw error.value
const filtered = computed(() => data.value?.items ?? [])
watch(
    () => route.query.game,
    () => {
        page.value = 1
    },
)
</script>

<template>
    <div v-if="route.query.game" class="mb-4 flex items-center gap-2">
        <GameMention :slug="String(route.query.game)" /><UButton
            to="/posts"
            label="All posts"
            variant="ghost"
        />
    </div>
    <p v-if="!filtered?.length" class="text-muted py-8 text-center">No posts found.</p>
    <UPage
        v-if="filtered?.length"
        :ui="{ center: 'sm:mx-4 grid grid-cols-1 gap-6 lg:grid-cols-2' }"
    >
        <article
            v-for="(post, index) in filtered"
            :key="String(post.slug)"
            :style="{ 'animation-delay': `${100 + index * 100}ms` }"
            class="fade-in hover:bg-muted flex flex-col justify-between gap-2 rounded-xl p-5 transition-colors"
        >
            <h2
                class="before:text-dimmed text-2xl font-bold before:font-mono before:-tracking-widest before:content-['//_']"
            >
                <PostTitle :title="post.title" :to="`/posts/${post.slug}`" />
            </h2>

            <MarkdownDocument
                v-if="post.excerpt.nodes.length"
                :value="post.excerpt"
                class="line-clamp-3 text-sm wrap-break-word *:first:mt-0 *:last:mb-0"
            />

            <div class="flex flex-wrap items-center gap-2">
                <NuxtTime
                    v-if="post.date"
                    :datetime="post.date"
                    date-style="short"
                    time-style="short"
                    class="text-muted font-mono text-sm"
                />
                <UBadge
                    v-for="(tag, tagIndex) in post.tags.filter((tag) => tag !== null)"
                    :key="`tag-${tagIndex}`"
                    :label="tag"
                    icon="mingcute:hashtag-line"
                    variant="soft"
                />
            </div>
        </article>
    </UPage>
    <UPagination
        v-if="data && data.total > 20"
        v-model:page="page"
        :total="data.total"
        :items-per-page="20"
        aria-label="Post pages"
        class="mt-6"
    />
</template>

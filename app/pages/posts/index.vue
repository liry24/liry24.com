<script setup lang="ts">
const { data } = await useSiteAdminList('posts', {
    markdown: 'summary',
    transform: (entries) =>
        entries.map((entry) => ({
            ...entry.data,
            slug: entry.slug,
            createdAt: entry.data.createdAt || entry.publishedAt,
        })),
})

useSeo()
</script>

<template>
    <UPage v-if="data?.length" :ui="{ center: 'sm:mx-4 grid grid-cols-1 gap-6 lg:grid-cols-2' }">
        <article
            v-for="(post, index) in data"
            :key="post.slug"
            :style="{ 'animation-delay': `${100 + index * 100}ms` }"
            class="fade-in hover:bg-muted flex flex-col justify-between gap-2 rounded-xl p-5 transition-colors"
        >
            <h2
                class="before:text-dimmed text-2xl font-bold before:font-mono before:-tracking-widest before:content-['//_']"
            >
                <NuxtLink :to="`/posts/${post.slug}`">{{ post.title }}</NuxtLink>
            </h2>

            <MarkdownDocument
                v-if="post.content.nodes.length"
                :value="post.content"
                class="sentence line-clamp-3 text-sm wrap-break-word *:first:mt-0 *:last:mb-0"
            />

            <div class="flex flex-wrap items-center gap-2">
                <NuxtTime
                    :datetime="post.createdAt"
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
</template>

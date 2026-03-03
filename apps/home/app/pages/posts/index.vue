<script setup lang="ts">
const { data } = await useFetch('/api/posts')

defineSeo({
    title: 'Posts',
    titleTemplate: '%s | Liry24',
    description: 'Blog posts by Liry24.',
    image: {
        component: 'Home.takumi',
        props: { title: 'Liry24', subpath: 'posts' },
        options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
    },
})
</script>

<template>
    <UPage v-if="data?.length" :ui="{ center: 'sm:mx-4 grid grid-cols-1 gap-6 lg:grid-cols-2' }">
        <NuxtLink
            v-for="(post, index) in data"
            :key="post.slug"
            :to="`/posts/${post.slug}`"
            variant="ghost"
            :style="{ 'animation-delay': `${100 + index * 100}ms` }"
            class="fade-in hover:bg-muted flex flex-col justify-between gap-2 rounded-xl p-5 transition-colors"
        >
            <h2
                class="before:text-dimmed text-2xl font-bold before:font-mono before:-tracking-widest before:content-['//_']"
            >
                {{ post.title }}
            </h2>

            <div class="flex flex-wrap items-center gap-2">
                <NuxtTime
                    :datetime="post.createdAt"
                    date-style="short"
                    time-style="short"
                    class="text-muted font-mono text-sm"
                />
                <UBadge
                    v-for="(tag, tagIndex) in post.tags"
                    :key="`tag-${tagIndex}`"
                    :label="tag.tag"
                    icon="mingcute:hashtag-line"
                    variant="soft"
                />
            </div>
        </NuxtLink>
    </UPage>
</template>

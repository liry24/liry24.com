<script setup lang="ts">
const route = useRoute()
const location = useBrowserLocation()
const { isSupported: isShareSupported, share } = useShare(() => ({
    title: data.value?.plainTitle || data.value?.title,
    url: location.value.href,
}))
const { isSupported: isCopySupported, copy, copied } = useClipboard()

const slugParam = computed(() => String(route.params.slug ?? ''))
const { data: post, error } = await useFetch<PostDetailResponse>(
    () => `/api/posts/${encodeURIComponent(slugParam.value)}`,
)
if (error.value) throw error.value

provide(
    postGameMentionsKey,
    computed(() => post.value?.games ?? {}),
)

const data = computed(() =>
    post.value
        ? {
              ...post.value.data,
              date: post.value.data.authoredAt ?? post.value.publishedAt ?? post.value.updatedAt,
          }
        : null,
)

if (!data.value) throw createError({ status: 404, statusText: 'Post not found' })
defineOgImage(
    'Post.takumi',
    {
        title: data.value.plainTitle || data.value.title || 'Post',
        description: post.value?.description,
        date: data.value.date?.slice(0, 10),
        tags: data.value.tags.filter((tag): tag is string => Boolean(tag)).slice(0, 3),
        cover: mediaUrl(data.value.cover),
    },
    { width: 1200, height: 630 },
)

if (post.value?.url && post.value.url !== route.path)
    await navigateTo(post.value.url, { redirectCode: 301 })

const siteOrigin = String(useRuntimeConfig().public.siteUrl || useRequestURL().origin).replace(
    /\/+$/,
    '',
)
const canonicalUrl = computed(() =>
    post.value?.url ? `${siteOrigin}${post.value.url}` : undefined,
)

useSeoMeta({
    title: () => data.value?.plainTitle || data.value?.title || 'Post',
    description: () => post.value?.description,
    ogTitle: () => data.value?.plainTitle || data.value?.title || 'Post',
    ogDescription: () => post.value?.description,
    ogType: 'article',
    ogUrl: () => canonicalUrl.value,
    articlePublishedTime: () => data.value?.date ?? undefined,
    articleModifiedTime: () => post.value?.updatedAt ?? undefined,
})

useHead({
    link: () => (canonicalUrl.value ? [{ rel: 'canonical', href: canonicalUrl.value }] : []),
})
</script>

<template>
    <UPage v-if="post && data" :ui="{ center: 'flex flex-col gap-6 items-center' }">
        <UContainer class="flex max-w-4xl flex-col items-center gap-6">
            <h1 class="text-heading text-center">
                <PostTitle :title="data.title" />
            </h1>

            <div class="flex items-center gap-3">
                <NuxtTime
                    v-if="data.date"
                    :datetime="data.date"
                    date-style="short"
                    time-style="short"
                    class="text-muted font-mono font-features-['calt'] text-sm tracking-wide"
                />
                <UBadge
                    v-for="(tag, index) in data.tags.filter((tag) => tag !== null)"
                    :key="`tag-${index}`"
                    :label="tag"
                    icon="mingcute:hashtag-line"
                    variant="soft"
                    class="ml-1"
                />
                <ClientOnly>
                    <div class="flex items-center gap-1">
                        <UTooltip v-if="isShareSupported" text="Share post">
                            <UButton
                                aria-label="Share post"
                                icon="mingcute:share-2-fill"
                                variant="ghost"
                                size="sm"
                                @click="share()"
                            />
                        </UTooltip>
                        <UTooltip v-if="isCopySupported && location.href" text="Copy post URL">
                            <UButton
                                aria-label="Copy post URL"
                                variant="ghost"
                                size="sm"
                                square
                                @click="copy(location.href)"
                            >
                                <Transition
                                    mode="out-in"
                                    enter-active-class="transition-[opacity,filter,transform] duration-70 ease-out motion-reduce:transition-none"
                                    enter-from-class="opacity-0 blur-md scale-95"
                                    enter-to-class="opacity-100 blur-none scale-100"
                                    leave-active-class="transition-[opacity,filter,transform] duration-70 ease-in motion-reduce:transition-none"
                                    leave-from-class="opacity-100 blur-none scale-100"
                                    leave-to-class="opacity-0 blur-md scale-95"
                                >
                                    <Icon
                                        :key="copied ? 'copied' : 'copy'"
                                        :name="
                                            copied ? 'mingcute:check-fill' : 'mingcute:link-3-fill'
                                        "
                                        class="size-4"
                                    />
                                </Transition>
                            </UButton>
                        </UTooltip>
                    </div>
                </ClientOnly>
            </div>

            <div class="flex w-full max-w-[65ch] flex-col gap-6">
                <USeparator decorative class="my-4" />

                <MarkdownDocument :value="post.document" class="px-1 *:first:mt-0 *:last:mb-0" />
            </div>
        </UContainer>
    </UPage>
</template>

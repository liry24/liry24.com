<script setup lang="ts">
import { cn } from 'cn'
import { motion } from 'motion-v'

import { LazyStacksModal } from '#components'

const { app } = useAppConfig()
const overlay = useOverlay()

const modalStacks = overlay.create(LazyStacksModal)
const MotionUSeparator = motion.create('hr')

const client = useSiteAdminClient()
const [{ data: arts }, { data: socials }, { data: careers }, { data: ranks }, { data: posts }] =
    await Promise.all([
        useAsyncData('public:arts', async () =>
            (await client.list<ContentEntry<'arts'>>('arts')).map(presentArt),
        ),
        useAsyncData('public:socials', async () =>
            (await client.list<ContentEntry<'socials'>>('socials')).map((entry) => entry.data),
        ),
        useAsyncData('public:careers', async () =>
            (await client.list<ContentEntry<'careers'>>('careers')).map((entry) => entry.data),
        ),
        useAsyncData('public:ranks', async () =>
            (await client.list<ContentEntry<'ranks'>>('ranks')).map((entry) => ({
                ...entry.data,
                imageUrl: entry.data.image?.url,
            })),
        ),
        useAsyncData('public:posts', async () =>
            (await client.list<ContentEntry<'posts'>>('posts')).map((entry) => ({
                ...entry.data,
                slug: entry.slug,
                createdAt: entry.data.createdAt || entry.publishedAt,
            })),
        ),
    ])
const data = computed(() => ({
    arts: arts.value || [],
    socials: socials.value || [],
    careers: careers.value || [],
    ranks: ranks.value || [],
    posts: posts.value || [],
}))

const rotateArray = <T>(arr: T[], n: number): T[] => {
    const len = arr.length
    if (len === 0) return arr

    const shift = n % len

    return [...arr.slice(-shift), ...arr.slice(0, -shift)]
}

useKeyCommand(modalStacks.open)

defineSeo({
    title: 'Liry24',
    description: 'Personal website of Liry24.',
    type: 'website',
    image: {
        component: 'Home.takumi',
        props: { title: 'Liry24' },
        options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
    },
})
</script>

<template>
    <div v-if="data" class="flex flex-col gap-16">
        <UMarquee
            pause-on-hover
            :ui="{ content: 'gap-8 md:gap-12 lg:gap-16' }"
            class="my-8 [--duration:40s]"
        >
            <Motion
                v-for="(art, index) in rotateArray(data.arts, 1)"
                :key="index"
                :initial="{ scale: 1.1, opacity: 0, filter: 'blur(20px)' }"
                :animate="{ scale: 1, opacity: 1, filter: 'blur(0px)' }"
                :transition="{ delay: 0.2 + index * 0.1 }"
            >
                <NuxtLink :to="`/arts?open=${art.slug}`">
                    <NuxtImg
                        :src="art.images[0]?.src"
                        :alt="art.title"
                        :height="320"
                        format="webp"
                        class="aspect-square size-64 cursor-pointer rounded-xl object-cover md:size-72 lg:size-80"
                    />
                </NuxtLink>
            </Motion>
        </UMarquee>

        <Motion :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ delay: 0.4 }">
            <div class="mx-auto mb-16 flex max-w-xl flex-wrap items-center justify-center gap-2">
                <UButton
                    v-for="(social, index) in data.socials"
                    :key="`social-${index}`"
                    :to="social.href"
                    target="_blank"
                    :icon="social.icon"
                    :label="social.label"
                    variant="ghost"
                    class="gap-2"
                />
            </div>
        </Motion>

        <Motion :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ delay: 0.6 }">
            <div class="flex w-full flex-col items-center gap-2">
                <div class="flex items-center gap-3 leading-none text-nowrap">
                    <Icon name="liria:liria" size="42" aria-hidden="true" class="text-toned" />
                    <h2 class="ml-1 pt-0.5 text-5xl font-extrabold">Liria</h2>
                    <p
                        class="text-muted pt-0.5 text-5xl font-thin tracking-tighter before:content-['//']"
                    >
                        Creation Circle
                    </p>
                </div>

                <div class="mt-4 flex items-center gap-2">
                    <UButton
                        :to="app.liria.website"
                        target="_blank"
                        aria-label="Website"
                        icon="mingcute:world-2-fill"
                        variant="link"
                    />
                    <UButton
                        :to="app.liria.x"
                        target="_blank"
                        aria-label="X"
                        icon="mingcute:social-x-fill"
                        variant="link"
                    />
                    <UButton
                        :to="app.liria.github"
                        target="_blank"
                        aria-label="Github"
                        icon="mingcute:github-fill"
                        variant="link"
                    />
                </div>

                <div class="grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
                    <NuxtLink
                        :to="app.liria.liriaGraphics"
                        target="_blank"
                        class="group relative flex size-full flex-col items-center justify-center gap-4 rounded-xl p-10"
                    >
                        <NuxtImg
                            src="/graphics-ss.png"
                            alt=""
                            class="absolute inset-0 size-full overflow-clip mask-x-from-60% mask-x-to-90% object-cover object-[0%_10%] opacity-10 transition-opacity group-hover:opacity-30"
                        />

                        <span class="z-1 text-5xl font-extrabold tracking-tight">
                            Liria<span class="font-thin tracking-tighter">Graphics</span>
                        </span>

                        <p class="text-toned z-1 text-center">
                            Digital Assets Store for VRChat Avatars. Available on BOOTH.
                        </p>
                    </NuxtLink>

                    <NuxtLink
                        :to="app.liria.avatio"
                        target="_blank"
                        class="group relative flex size-full flex-col items-center justify-center gap-4 rounded-xl p-10"
                    >
                        <UColorModeImage
                            light="/avatio-ss-light.png"
                            dark="/avatio-ss-dark.png"
                            alt=""
                            class="absolute inset-0 size-full overflow-clip mask-x-from-60% mask-x-to-90% object-cover object-[0%_10%] opacity-10 transition-opacity group-hover:opacity-30"
                        />

                        <span class="z-1 text-5xl font-extrabold tracking-tight"> Avatio </span>

                        <p class="text-toned z-1 text-center">
                            VR-SNS Avatar Setups Sharing Platform.
                        </p>
                    </NuxtLink>
                </div>
            </div>
        </Motion>

        <MotionUSeparator
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :transition="{ delay: 0.65 }"
            class="my-12 max-w-sm self-center"
        />

        <div class="grid w-full max-w-6xl grid-cols-1 gap-x-16 gap-y-24 self-center lg:grid-cols-2">
            <Motion
                as="div"
                :initial="{ opacity: 0, filter: 'blur(20px)' }"
                :animate="{ opacity: 1, filter: 'blur(0px)' }"
                :transition="{ delay: 0.7 }"
                class="grid gap-4"
            >
                <h2
                    class="text-muted font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Career
                </h2>
                <div
                    v-for="(career, index) in data.careers"
                    :key="`career-${index}`"
                    class="text-muted mx-2 flex flex-col items-start gap-1 tracking-wide"
                >
                    <p class="font-mono text-sm text-nowrap">{{ career.period }}</p>
                    <p class="text-toned font-medium">
                        {{ career.position }}
                        <span class="text-muted font-light">at </span>
                        <span class="text-highlighted">{{ career.company }}</span>
                    </p>
                </div>
            </Motion>

            <Motion
                as="div"
                :initial="{ opacity: 0, filter: 'blur(20px)' }"
                :animate="{ opacity: 1, filter: 'blur(0px)' }"
                :transition="{ delay: 0.8 }"
                class="grid gap-4"
            >
                <h2
                    class="text-muted font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Ranks
                </h2>

                <NuxtLink
                    v-for="(rank, index) in data.ranks"
                    :key="`rank-${index}`"
                    :to="rank.href || undefined"
                    target="_blank"
                    :class="
                        cn(
                            'mx-auto flex items-center gap-1 px-6 py-3 text-2xl leading-none text-nowrap',
                            rank.href && 'hover:bg-muted rounded-xl transition-colors',
                        )
                    "
                >
                    <p class="leading-none font-bold">{{ rank.game }}</p>
                    <p class="text-muted leading-none font-extralight tracking-tight">
                        {{ rank.season }}
                    </p>
                    <NuxtImg :src="rank.imageUrl" :alt="rank.rank" :width="40" :height="40" />
                </NuxtLink>
            </Motion>
        </div>

        <MotionUSeparator
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :transition="{ delay: 0.9 }"
            class="my-12 max-w-sm self-center"
        />

        <div class="grid w-full max-w-6xl grid-cols-1 gap-x-16 gap-y-24 self-center lg:grid-cols-2">
            <Motion
                as="div"
                :initial="{ opacity: 0, filter: 'blur(20px)' }"
                :animate="{ opacity: 1, filter: 'blur(0px)' }"
                :transition="{ delay: 1 }"
                class="flex flex-col gap-4 lg:col-span-2"
            >
                <h2
                    class="text-muted font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Latest Posts
                </h2>

                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <NuxtLink
                        v-for="post in data.posts.slice(0, 10)"
                        :key="post.slug"
                        :to="`/posts/${post.slug}`"
                        class="hover:bg-muted flex h-fit flex-col gap-3 rounded-xl p-6 transition-colors"
                    >
                        <h2 class="line-clamp-2 text-2xl font-bold">
                            {{ post.title }}
                        </h2>

                        <div class="flex flex-wrap items-center gap-2">
                            <NuxtTime
                                :datetime="post.createdAt"
                                date-style="short"
                                time-style="short"
                                class="text-muted font-mono text-sm leading-none text-nowrap"
                            />
                            <UBadge
                                v-for="(tag, index) in post.tags.filter((tag) => tag !== null)"
                                :key="`tag-${index}`"
                                :label="tag"
                                icon="mingcute:hashtag-line"
                                variant="soft"
                            />
                        </div>
                    </NuxtLink>
                </div>
            </Motion>
        </div>
    </div>
</template>

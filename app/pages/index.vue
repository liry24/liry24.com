<script setup lang="ts">
import { motion } from 'motion-v'

import { LazyStacksModal } from '#components'

const { app } = useAppConfig()
useHead({ titleTemplate: null })
useSeoMeta({ title: 'Liry24', description: 'Personal website of Liry24.' })
defineOgImage('Home.takumi', { title: 'Liry24' }, [
    { key: 'og' },
    { key: 'whatsapp', width: 800, height: 800 },
])
const overlay = useOverlay()

const modalStacks = overlay.create(LazyStacksModal)
const MotionUSeparator = motion.create('hr')

const arts = usePortfolioQuery('arts')
const socials = usePortfolioQuery('socials')
const careers = usePortfolioQuery('careers')
const ranks = usePortfolioQuery('ranks')
const games = usePortfolioQuery('games')
const gameStats = usePortfolioQuery('gameStats')
const posts = useFetch<PostCardsPage>('/api/posts/cards', { query: { limit: 10 } })
await Promise.all([arts, socials, careers, ranks, games, gameStats, posts])
const data = computed(() => ({
    arts: arts.data.value || [],
    socials: socials.data.value?.map((entry) => entry.data) || [],
    careers: careers.data.value?.map((entry) => entry.data) || [],
    ranks:
        ranks.data.value?.map((entry) => ({
            ...entry.data,
            entryId: entry.id,
            imageUrl: mediaUrl(entry.data.image),
        })) || [],
    posts: posts.data.value?.items ?? [],
}))

const statGames = computed(() =>
    (games.data.value ?? [])
        .map((game) => ({
            ...game,
            periods: (gameStats.data.value ?? [])
                .filter((period) => period.data.game === game.id)
                .map((period) => period.data),
        }))
        .filter((game) => game.periods.length),
)

// shortcut: retain unmigrated rank cards until the legacy model is retired.
const legacyRanks = computed(() =>
    data.value.ranks.filter(
        (rank) =>
            !gameStats.data.value?.some((period) => period.id === `legacy-${rank.entryId}`) &&
            !statGames.value.some(
                (game) => game.data.name.toLowerCase() === rank.game.toLowerCase(),
            ),
    ),
)

const rotateArray = <T>(arr: T[], n: number): T[] => {
    const len = arr.length
    if (len === 0) return arr

    const shift = n % len

    return [...arr.slice(-shift), ...arr.slice(0, -shift)]
}

useKeyCommand(modalStacks.open)
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
                <NuxtLink :to="`/arts?open=${art.data.slug}`">
                    <NuxtImg
                        :src="mediaUrl(art.data.images[0])"
                        :alt="art.data.title"
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

                <GameStats
                    v-for="game in statGames"
                    :key="game.id"
                    :game="game.data"
                    :periods="game.periods"
                />
                <NuxtLink
                    v-for="(rank, index) in legacyRanks"
                    :key="`legacy-rank-${index}`"
                    :to="rank.href || undefined"
                    target="_blank"
                    class="hover:bg-muted mx-auto flex items-center gap-1 rounded-xl px-6 py-3 text-2xl"
                    ><span class="font-bold">{{ rank.game }}</span
                    ><span class="text-muted font-light">{{ rank.season }}</span
                    ><NuxtImg :src="rank.imageUrl" :alt="rank.rank" :width="40" :height="40"
                /></NuxtLink>
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
                    <article
                        v-for="post in data.posts.slice(0, 10)"
                        :key="String(post.slug)"
                        class="hover:bg-muted flex h-fit flex-col gap-3 rounded-xl p-6 transition-colors"
                    >
                        <h2 class="line-clamp-2 text-2xl font-bold">
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
                    </article>
                </div>
            </Motion>
        </div>
    </div>
</template>

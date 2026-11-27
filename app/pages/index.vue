<script setup lang="ts">
import { motion } from 'motion-v'

import { LazyGameStatsViewer, LazyStacksModal } from '#components'

const route = useRoute()
const appConfig = useAppConfig()
const { app } = appConfig
const overlay = useOverlay()

const modalStacks = overlay.create(LazyStacksModal)
const modalGameStats = overlay.create(LazyGameStatsViewer)

const arts = usePortfolioData('arts')
const socials = usePortfolioData('socials')
const careers = usePortfolioData('careers')
const gameStats = useFetch('/api/portfolio/gameStats')
const posts = useFetch<PostCardsPage>('/api/posts/cards', { query: { limit: 10 } })
await Promise.all([arts, socials, careers, gameStats, posts])
const data = computed(() => ({
    arts: arts.data.value || [],
    socials: socials.data.value?.map((entry) => entry.data) || [],
    careers: careers.data.value?.map((entry) => entry.data) || [],
    posts: posts.data.value?.items ?? [],
}))

const statGames = computed(() =>
    (gameStats.data.value?.games ?? []).map((game) => ({
        ...game,
        periods: (gameStats.data.value?.items ?? [])
            .filter((period) => period.data.game === game.id)
            .map((period) => period.data),
    })),
)

const rotateArray = <T>(arr: Array<T>, n: number): Array<T> => {
    const len = arr.length
    if (len === 0) return arr

    const shift = n % len

    return [...arr.slice(-shift), ...arr.slice(0, -shift)]
}

useKeyCommand(modalStacks.open)

onMounted(() => {
    const slug = typeof route.query.game === 'string' ? route.query.game : undefined
    const matched = slug ? statGames.value.find((entry) => entry.data.slug === slug) : undefined
    if (matched) modalGameStats.open({ game: matched.data, periods: matched.periods })
})

useHead({ titleTemplate: null })
useSeoMeta({ title: 'Liry24', description: 'Personal website of Liry24.' })
defineOgImage('Home.takumi', { title: 'Liry24' }, [
    { key: 'og' },
    { key: 'whatsapp', width: 800, height: 800 },
])
</script>

<template>
    <div v-if="data" class="flex flex-col gap-14 sm:gap-16">
        <UMarquee
            v-if="data.arts.length"
            pause-on-hover
            :overlay="false"
            :ui="{ content: 'gap-5 sm:gap-8 md:gap-10 lg:gap-12' }"
            class="my-2 mask-x-from-88% mask-x-to-100% [--duration:42s]"
        >
            <Motion
                v-for="(art, index) in rotateArray(data.arts, 1)"
                :key="art.id"
                :initial="{ scale: 1.04, opacity: 0 }"
                :animate="{ scale: 1, opacity: 1 }"
                :transition="{ delay: Math.min(0.05 + index * 0.04, 0.25) }"
            >
                <NuxtLink
                    :to="`/arts?open=${art.data.slug}`"
                    class="group bg-muted/50 ring-default/70 relative block overflow-hidden rounded-2xl ring-1 focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    <NuxtImg
                        :src="mediaUrl(art.data.images[0])"
                        :alt="art.data.title"
                        :height="320"
                        format="webp"
                        class="aspect-square size-56 object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 sm:size-64 md:size-72 lg:size-80"
                    />
                    <div
                        aria-hidden="true"
                        class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pt-10 pb-3.5 text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    >
                        <span class="line-clamp-1 text-sm font-medium tracking-tight">
                            {{ art.data.title }}
                        </span>
                    </div>
                </NuxtLink>
            </Motion>
        </UMarquee>

        <Motion
            v-if="data.socials.length"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ delay: 0.1 }"
        >
            <div
                class="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-1.5 sm:gap-2"
            >
                <UButton
                    v-for="(social, index) in data.socials"
                    :key="`social-${index}`"
                    :to="social.href"
                    target="_blank"
                    :icon="social.icon"
                    :label="social.label"
                    color="neutral"
                    variant="ghost"
                    class="gap-2"
                />
            </div>
        </Motion>

        <Motion
            :initial="{ opacity: 0, y: 10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ delay: 0.15 }"
        >
            <section class="flex w-full flex-col items-center gap-2">
                <div
                    class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 leading-none"
                >
                    <span class="inline-flex items-center gap-3">
                        <Icon
                            name="liria:liria"
                            data-icon-ic="false"
                            aria-hidden="true"
                            class="text-toned size-8 shrink-0 sm:size-9 md:size-[42px]"
                        />
                        <h2
                            class="text-highlighted ml-1 pt-0.5 text-3xl font-extrabold sm:text-4xl md:text-5xl"
                        >
                            Liria
                        </h2>
                    </span>
                    <p
                        class="text-muted pt-0.5 text-3xl font-thin tracking-tighter before:content-['//'] sm:text-4xl md:text-5xl"
                    >
                        Creation Circle
                    </p>
                </div>

                <div class="mt-4 flex items-center gap-2">
                    <UButton
                        :to="app.liria.website"
                        target="_blank"
                        aria-label="Liria Website"
                        icon="mingcute:world-2-fill"
                        color="neutral"
                        variant="ghost"
                    />
                    <UButton
                        :to="app.liria.x"
                        target="_blank"
                        aria-label="Liria X"
                        icon="mingcute:social-x-fill"
                        color="neutral"
                        variant="ghost"
                    />
                    <UButton
                        :to="app.liria.github"
                        target="_blank"
                        aria-label="Liria GitHub"
                        icon="mingcute:github-fill"
                        color="neutral"
                        variant="ghost"
                    />
                </div>

                <div class="grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
                    <NuxtLink
                        :to="app.liria.liriaGraphics"
                        target="_blank"
                        class="group relative flex size-full flex-col items-center justify-center gap-4 rounded-xl p-10 focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        <NuxtImg
                            src="/graphics-ss.png"
                            alt=""
                            class="pointer-events-none absolute inset-0 size-full overflow-clip mask-x-from-60% mask-x-to-90% object-cover object-[0%_10%] opacity-10 transition-opacity group-hover:opacity-30 motion-reduce:transition-none"
                        />

                        <span class="z-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Liria<span class="font-thin tracking-tighter">Graphics</span>
                        </span>

                        <p class="text-toned z-1 text-center">
                            Digital Assets Store for VRChat Avatars. Available on BOOTH.
                        </p>
                    </NuxtLink>

                    <NuxtLink
                        :to="app.liria.avatio"
                        target="_blank"
                        class="group relative flex size-full flex-col items-center justify-center gap-4 rounded-xl p-10 focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        <UColorModeImage
                            light="/avatio-ss-light.png"
                            dark="/avatio-ss-dark.png"
                            alt=""
                            class="pointer-events-none absolute inset-0 size-full overflow-clip mask-x-from-60% mask-x-to-90% object-cover object-[0%_10%] opacity-10 transition-opacity group-hover:opacity-30 motion-reduce:transition-none"
                        />

                        <span class="z-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Avatio
                        </span>

                        <p class="text-toned z-1 text-center">
                            VR-SNS Avatar Setups Sharing Platform.
                        </p>
                    </NuxtLink>
                </div>
            </section>
        </Motion>

        <USeparator decorative class="mx-auto max-w-xs" />

        <div
            class="grid w-full max-w-6xl grid-cols-1 items-start gap-x-16 gap-y-14 self-center lg:grid-cols-2"
        >
            <Motion
                as="section"
                :initial="{ opacity: 0, y: 10 }"
                :animate="{ opacity: 1, y: 0 }"
                :transition="{ delay: 0.2 }"
                class="flex flex-col gap-5"
            >
                <h2
                    class="text-muted before:text-dimmed font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Career
                </h2>
                <ol
                    v-if="data.careers.length"
                    class="border-default flex flex-col gap-4 border-s ps-4 sm:ps-5"
                >
                    <li
                        v-for="(career, index) in data.careers"
                        :key="`career-${index}`"
                        class="flex flex-col items-start gap-1"
                    >
                        <p class="text-muted font-mono text-xs text-nowrap tabular-nums sm:text-sm">
                            {{ career.period }}
                        </p>
                        <p class="text-toned text-sm font-medium sm:text-base">
                            {{ career.position }}
                            <span class="text-muted font-normal">at </span>
                            <span class="text-highlighted font-semibold">{{ career.company }}</span>
                        </p>
                    </li>
                </ol>
            </Motion>

            <Motion
                as="section"
                :initial="{ opacity: 0, y: 10 }"
                :animate="{ opacity: 1, y: 0 }"
                :transition="{ delay: 0.22 }"
                class="flex flex-col gap-5"
            >
                <h2
                    class="text-muted before:text-dimmed font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Game Stats
                </h2>

                <div class="grid gap-3">
                    <GameStats
                        v-for="game in statGames"
                        :key="game.id"
                        :game="game.data"
                        :periods="game.periods"
                    />
                </div>
            </Motion>
        </div>

        <USeparator decorative class="mx-auto max-w-xs" />

        <Motion
            as="section"
            :initial="{ opacity: 0, y: 10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ delay: 0.25 }"
            class="flex w-full max-w-6xl flex-col gap-5 self-center"
        >
            <div class="flex items-center justify-between gap-4">
                <h2
                    class="text-muted before:text-dimmed font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Latest Posts
                </h2>
                <UButton
                    to="/posts"
                    label="All posts"
                    :trailing-icon="appConfig.ui.icons.arrowRight"
                    variant="link"
                    color="neutral"
                    size="sm"
                    class="p-0 font-mono text-xs"
                />
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                <article
                    v-for="post in data.posts.slice(0, 10)"
                    :key="String(post.slug)"
                    class="hover:border-default hover:bg-muted/60 flex h-full flex-col justify-between gap-3 rounded-2xl border border-transparent p-5 transition-[background-color,border-color] duration-200 ease-out motion-reduce:transition-none sm:p-6"
                >
                    <div class="flex flex-col gap-2.5">
                        <h3
                            class="text-highlighted line-clamp-2 text-xl font-bold tracking-tight sm:text-2xl"
                        >
                            <PostTitle :title="post.title" :to="`/posts/${post.slug}`" />
                        </h3>

                        <MarkdownDocument
                            v-if="post.excerpt.nodes.length"
                            :value="post.excerpt"
                            class="text-toned line-clamp-3 text-sm leading-relaxed wrap-break-word *:first:mt-0 *:last:mb-0"
                        />
                    </div>

                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                        <NuxtTime
                            v-if="post.date"
                            :datetime="post.date"
                            date-style="short"
                            time-style="short"
                            class="text-muted font-mono text-xs leading-none text-nowrap tabular-nums sm:text-sm"
                        />
                        <span
                            v-for="(tag, index) in post.tags.filter((tag) => tag !== null)"
                            :key="`tag-${index}`"
                            class="text-muted font-mono text-xs"
                        >
                            #{{ tag }}
                        </span>
                    </div>
                </article>
            </div>
        </Motion>
    </div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v'

import { LazyStacksModal, NuxtImg, USeparator } from '#components'

const { app } = useAppConfig()
const overlay = useOverlay()
const config = useRuntimeConfig()

const modalStacks = overlay.create(LazyStacksModal)
const MotionNuxtImg = motion.create(NuxtImg)
const MotionUSeparator = motion.create(USeparator)

const { data } = useFetch('/api/home')

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
            <MotionNuxtImg
                v-for="(art, index) in rotateArray(data.arts, 1)"
                :key="index"
                :initial="{
                    scale: 1.1,
                    opacity: 0,
                    filter: 'blur(20px)',
                }"
                :animate="{
                    scale: 1,
                    opacity: 1,
                    filter: 'blur(0px)',
                }"
                :transition="{
                    delay: 0.2 + index * 0.1,
                }"
                :src="art.images[0]?.src"
                :alt="art.title"
                :width="320"
                :height="320"
                format="webp"
                class="aspect-square size-64 cursor-pointer rounded-xl object-cover md:size-72 lg:size-80"
                @click="navigateTo(`/arts?open=${art.slug}`)"
            />
        </UMarquee>

        <motion.div
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :transition="{
                delay: 0.4,
            }"
            class="mx-auto mb-16 flex max-w-xl flex-wrap items-center justify-center gap-2"
        >
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
        </motion.div>

        <motion.div
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :transition="{
                delay: 0.6,
            }"
            class="flex w-full flex-col items-center gap-2"
        >
            <div class="flex items-center gap-2">
                <Icon name="liria:liria" size="32" aria-hidden="true" />
                <h2 class="text-toned ml-1 pt-0.5 text-3xl leading-none font-extrabold text-nowrap">
                    Liria
                </h2>
                <p
                    class="text-muted pt-0.5 text-3xl leading-none font-thin tracking-tight text-nowrap before:content-['//_']"
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

                    <p class="text-toned z-1 text-center">VR-SNS Avatar Setups Sharing Platform.</p>
                </NuxtLink>
            </div>
        </motion.div>

        <MotionUSeparator
            :initial="{
                opacity: 0,
            }"
            :animate="{
                opacity: 1,
            }"
            :transition="{
                delay: 0.65,
            }"
            class="mt-12 mb-20 max-w-sm self-center"
        />

        <div class="grid w-full max-w-6xl grid-cols-1 gap-x-16 gap-y-24 self-center lg:grid-cols-2">
            <motion.div
                :initial="{
                    opacity: 0,
                    filter: 'blur(20px)',
                }"
                :animate="{
                    opacity: 1,
                    filter: 'blur(0px)',
                }"
                :transition="{
                    delay: 0.7,
                }"
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
                    class="text-muted mx-2 flex flex-col items-start gap-2 font-medium tracking-wide sm:flex-row sm:items-center"
                >
                    <p class="text-nowrap">{{ career.period }}</p>
                    <Icon
                        name="mingcute:right-small-fill"
                        size="18"
                        class="text-muted hidden sm:block"
                    />
                    <p class="grow">
                        {{ career.position }} at
                        <span class="text-toned">{{ career.company }}</span>
                    </p>
                </div>
            </motion.div>

            <motion.div
                :initial="{
                    opacity: 0,
                    filter: 'blur(20px)',
                }"
                :animate="{
                    opacity: 1,
                    filter: 'blur(0px)',
                }"
                :transition="{
                    delay: 0.8,
                }"
                class="grid gap-4"
            >
                <h2
                    class="text-muted font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Ranks
                </h2>
                <div
                    v-for="(rank, index) in data.ranks"
                    :key="`rank-${index}`"
                    class="mx-auto flex items-center gap-1 text-2xl leading-none text-nowrap"
                >
                    <p class="leading-none font-bold">{{ rank.game }}</p>
                    <p class="text-muted leading-none font-extralight tracking-tight">
                        {{ rank.season }}
                    </p>
                    <NuxtImg :src="rank.imageUrl" :alt="rank.rank" :width="40" :height="40" />
                </div>
            </motion.div>

            <!-- <motion.div
                :initial="{
                    opacity: 0,
                    filter: 'blur(20px)',
                }"
                :animate="{
                    opacity: 1,
                    filter: 'blur(0px)',
                }"
                :transition="{
                    delay: 0.9,
                }"
                class="flex flex-col gap-4 lg:col-span-2"
            >
                <h2
                    class="text-muted font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Skills
                </h2>

                <div class="flex flex-wrap gap-2">
                    <Icon
                        v-for="skill in data.skills"
                        :key="`skill-${skill.id}`"
                        :name="skill.icon"
                        size="20"
                    />
                </div>
            </motion.div> -->

            <motion.div
                :initial="{
                    opacity: 0,
                    filter: 'blur(20px)',
                }"
                :animate="{
                    opacity: 1,
                    filter: 'blur(0px)',
                }"
                :transition="{
                    delay: 1,
                }"
                class="flex flex-col gap-4 lg:col-span-2"
            >
                <h2
                    class="text-muted font-mono text-sm leading-none text-nowrap before:content-['//_']"
                >
                    Latest Posts
                </h2>

                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <NuxtLink
                        v-for="post in data.posts"
                        :key="post.slug"
                        :to="`/posts/${post.slug}`"
                        class="hover:bg-muted flex h-fit flex-col gap-3 rounded-xl p-6 transition-colors"
                    >
                        <h2
                            class="before:text-dimmed line-clamp-2 text-2xl font-bold before:font-mono before:-tracking-widest before:content-['//_']"
                        >
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
                                v-for="(tag, index) in post.tags"
                                :key="`tag-${index}`"
                                :label="tag.tag"
                                icon="mingcute:hashtag-line"
                                variant="soft"
                            />
                        </div>
                    </NuxtLink>
                </div>
            </motion.div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v'

import { NuxtLink } from '#components'

const route = useRoute()

const MotionNuxtLink = motion.create(NuxtLink)

const tabs = [
    {
        label: 'arts',
        to: '/arts',
    },
    // {
    //     label: 'works',
    //     to: '/works',
    // },
    {
        label: 'posts',
        to: '/posts',
    },
]

const title = ref('Liry24')
const originalTitle = ref('Liry24')
const titleHovered = ref(false)

watch(
    () => route.path,
    () => {
        const text = tabs.find((tab) => route.path.startsWith(tab.to))?.label || 'Liry24'
        title.value = text
        originalTitle.value = text
        titleHovered.value = false
    },
    { immediate: true }
)

const handleMouseEnter = () => {
    if (route.path !== '/') {
        title.value = 'back to home'
        titleHovered.value = true
    }
}

const handleMouseLeave = () => {
    title.value = originalTitle.value
    titleHovered.value = false
}
</script>

<template>
    <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
        <div class="flex flex-col gap-16">
            <div class="mx-8 my-12 flex min-h-dvh flex-col gap-12 md:mx-12 lg:mx-24 lg:mt-24">
                <header class="fade-in flex w-full flex-col items-center gap-3">
                    <MotionNuxtLink
                        to="/"
                        class="flex items-center gap-3"
                        @mouseenter="handleMouseEnter"
                        @mouseleave="handleMouseLeave"
                    >
                        <NuxtImg
                            v-if="route.path === '/'"
                            v-slot="{ src, imgAttrs, isLoaded }"
                            src="https://images.liry24.com/avatar.png"
                            alt=""
                            class="aspect-square size-14 rounded-full object-cover"
                        >
                            <img v-if="isLoaded" v-bind="imgAttrs" :src />
                            <USkeleton v-else class="aspect-square size-14 rounded-full" />
                        </NuxtImg>
                        <Icon v-if="titleHovered" name="mingcute:arrow-left-fill" size="58" />
                        <HyperText
                            :text="title"
                            :duration="500"
                            as="h1"
                            :class="
                                cn(
                                    'font-[Special_Gothic_Expanded_One] text-6xl leading-none tracking-tight',
                                    route.path === '/' && 'w-56',
                                    titleHovered && 'w-117'
                                )
                            "
                        />
                    </MotionNuxtLink>

                    <div class="ml-1 flex items-center gap-2">
                        <UNavigationMenu
                            :items="tabs"
                            color="neutral"
                            variant="link"
                            orientation="horizontal"
                            class="text-toned ml-auto font-mono text-lg font-medium"
                        />

                        <ColorModeButton />
                    </div>
                </header>

                <main class="contents">
                    <slot />
                </main>
            </div>

            <footer
                class="fade-in @container mx-8 mb-10 flex flex-col items-center gap-3 md:mx-12 lg:mx-24"
            >
                <USeparator />

                <div class="text-dimmed mt-8 flex w-full justify-between gap-3 px-10 text-sm">
                    <p>
                        Avatar illustration:
                        <UButton
                            to="https://x.com/terano_naa"
                            target="_blank"
                            external
                            variant="link"
                            label="寺乃なあ"
                            trailing-icon="mingcute:arrow-right-up-line"
                            class="gap-0.5 p-0"
                            :ui="{
                                label: 'leading-none',
                                trailingIcon: 'text-dimmed size-4.5',
                            }"
                        />
                    </p>
                    <p class="leading-none text-nowrap">{{ new Date().getFullYear() }} © Liry24</p>
                </div>

                <span
                    class="text-dimmed/30 max-w-dvw overflow-clip mask-b-from-40% mask-b-to-80% font-[Special_Gothic_Expanded_One] text-[28cqw] select-none"
                >
                    Liry24
                </span>
            </footer>
        </div>
    </MotionConfig>
</template>

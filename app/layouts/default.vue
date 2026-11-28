<script setup lang="ts">
const route = useRoute()
const appConfig = useAppConfig()

const tabs = [
    {
        label: 'arts',
        to: '/arts',
    },
    {
        label: 'works',
        to: '/works',
    },
    {
        label: 'posts',
        to: '/posts',
    },
]

const titleHovered = ref(false)
const originalTitle = computed(
    () => tabs.find((tab) => route.path.startsWith(tab.to))?.label || 'Liry24',
)
const title = computed(() => (titleHovered.value ? 'back to home' : originalTitle.value))

watch(
    () => route.path,
    () => {
        titleHovered.value = false
    },
)

const handleMouseEnter = () => {
    if (route.path !== '/') titleHovered.value = true
}

const handleMouseLeave = () => {
    titleHovered.value = false
}

const showIgdbAttribution = computed(() => route.path === '/' || route.path.startsWith('/posts'))
</script>

<template>
    <div class="flex flex-col gap-16">
        <MotionConfig
            :transition="{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }"
            reduced-motion="user"
        >
            <div
                class="mx-5 my-8 flex min-h-dvh flex-col gap-10 sm:mx-8 sm:my-12 md:mx-12 md:gap-12 lg:mx-24 lg:mt-20"
            >
                <header class="flex w-full flex-col items-center gap-3">
                    <NuxtLink
                        to="/"
                        class="flex min-h-11 max-w-full items-center justify-center gap-2.5 rounded-xl px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-4 sm:min-h-14 sm:gap-3"
                        @mouseenter="handleMouseEnter"
                        @mouseleave="handleMouseLeave"
                    >
                        <img
                            v-if="route.path === '/'"
                            :src="'/avatar.webp?size=112'"
                            alt=""
                            width="56"
                            height="56"
                            loading="eager"
                            class="ring-default/70 aspect-square size-11 shrink-0 rounded-full object-cover ring-1 sm:size-13 md:size-14"
                        />
                        <Icon
                            v-if="titleHovered"
                            name="mingcute:arrow-left-fill"
                            data-icon-ic="false"
                            aria-hidden="true"
                            class="size-8 shrink-0 sm:size-10 md:size-12"
                        />
                        <HyperText
                            :text="title"
                            :duration="450"
                            as="h1"
                            class="text-highlighted font-[Special_Gothic_Expanded_One] text-4xl leading-none tracking-tight sm:text-5xl md:text-6xl"
                        />
                    </NuxtLink>

                    <div class="flex items-center gap-1.5 sm:gap-2">
                        <nav
                            aria-label="Primary"
                            class="text-toned flex items-center gap-3 font-mono text-base font-medium sm:gap-4 sm:text-lg"
                        >
                            <NuxtLink
                                v-for="tab in tabs"
                                :key="tab.to"
                                :to="tab.to"
                                :aria-current="route.path.startsWith(tab.to) ? 'page' : undefined"
                                :class="
                                    cn(
                                        'hover:text-highlighted rounded-md px-1.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
                                        route.path.startsWith(tab.to) && 'text-highlighted',
                                    )
                                "
                            >
                                {{ tab.label }}
                            </NuxtLink>
                        </nav>

                        <ColorModeButton />
                    </div>
                </header>

                <main class="contents">
                    <slot />
                </main>
            </div>

            <footer
                class="@container mx-5 mb-8 flex flex-col items-center gap-3 sm:mx-8 sm:mb-10 md:mx-12 lg:mx-24"
            >
                <USeparator decorative />

                <div
                    class="text-muted mt-6 flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm sm:px-6"
                >
                    <p>
                        Avatar illustration:
                        <UButton
                            to="https://x.com/terano_naa"
                            target="_blank"
                            external
                            variant="link"
                            color="neutral"
                            label="寺乃なあ"
                            :trailing-icon="appConfig.ui.icons.external"
                            class="gap-0.5 p-0"
                            :ui="{
                                label: 'leading-none',
                                trailingIcon: 'text-dimmed size-4',
                            }"
                        />
                    </p>
                    <p class="leading-none text-nowrap tabular-nums">
                        {{ new Date().getFullYear() }} © Liry24
                    </p>
                </div>

                <NuxtLink
                    v-if="showIgdbAttribution"
                    to="https://www.igdb.com"
                    target="_blank"
                    rel="noopener"
                    class="text-muted hover:text-default text-xs transition-colors"
                    >Game data by IGDB</NuxtLink
                >

                <svg
                    aria-hidden="true"
                    focusable="false"
                    class="text-dimmed/30 h-[1.5em] w-[3.854em] max-w-dvw overflow-clip mask-b-from-40% mask-b-to-80% font-[Special_Gothic_Expanded_One] text-[28cqw] select-none"
                >
                    <text x="50%" y="1.11em" text-anchor="middle" fill="currentColor">Liry24</text>
                </svg>
            </footer>
        </MotionConfig>
    </div>
</template>

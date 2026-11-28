<script setup lang="ts">
const route = useRoute()

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
        <MotionConfig :transition="{ duration: 0.6 }" reduced-motion="user">
            <div class="mx-8 my-12 flex min-h-dvh flex-col gap-12 md:mx-12 lg:mx-24 lg:mt-24">
                <header class="flex w-full flex-col items-center gap-3">
                    <NuxtLink
                        to="/"
                        class="flex items-center gap-3"
                        @mouseenter="handleMouseEnter"
                        @mouseleave="handleMouseLeave"
                    >
                        <NuxtImg
                            v-if="route.path === '/'"
                            src="/avatar.webp?size=112"
                            provider="none"
                            alt=""
                            :width="56"
                            :height="56"
                            loading="eager"
                            class="aspect-square size-14 rounded-full object-cover"
                        />
                        <Icon v-if="titleHovered" name="mingcute:arrow-left-fill" size="58" />
                        <HyperText
                            :text="title"
                            :duration="500"
                            as="h1"
                            :class="
                                cn(
                                    'font-[Special_Gothic_Expanded_One] text-6xl leading-none tracking-tight',
                                    route.path === '/' && 'w-56',
                                    titleHovered && 'w-117',
                                )
                            "
                        />
                    </NuxtLink>

                    <div class="ml-1 flex items-center gap-2">
                        <nav
                            aria-label="Primary"
                            class="text-toned ml-auto flex items-center gap-4 font-mono text-lg font-medium"
                        >
                            <NuxtLink
                                v-for="tab in tabs"
                                :key="tab.to"
                                :to="tab.to"
                                :aria-current="route.path.startsWith(tab.to) ? 'page' : undefined"
                                :class="
                                    cn(
                                        'px-1.5 py-1 transition-colors hover:text-highlighted',
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
                class="@container mx-8 mb-10 flex flex-col items-center gap-3 md:mx-12 lg:mx-24"
            >
                <USeparator decorative />

                <div
                    class="text-muted mt-8 flex w-full items-center justify-between gap-3 text-sm sm:px-10"
                >
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

                <NuxtLink
                    v-if="showIgdbAttribution"
                    to="https://www.igdb.com"
                    target="_blank"
                    rel="noopener"
                    class="text-muted text-xs"
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

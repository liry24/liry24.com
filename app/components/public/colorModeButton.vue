<script setup lang="ts">
const colorMode = useColorMode()
const appConfig = useAppConfig()

const nextTheme = computed(() => (colorMode.value === 'dark' ? 'light' : 'dark'))
const themeIcon = computed(() =>
    nextTheme.value === 'dark' ? appConfig.ui.icons.light : appConfig.ui.icons.dark,
)

const switchTheme = () => {
    colorMode.preference = nextTheme.value
}

const startViewTransition = (event: MouseEvent) => {
    if (
        !document.startViewTransition ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
        switchTheme()
        return
    }

    const x = event.clientX
    const y = event.clientY
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
    )

    const transition = document.startViewTransition(() => {
        switchTheme()
    })

    transition.ready.then(() => {
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 500,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)',
            },
        )
    })
}
</script>

<template>
    <ClientOnly>
        <UButton
            :aria-label="`Switch to ${nextTheme} mode`"
            :icon="themeIcon"
            color="neutral"
            variant="ghost"
            size="sm"
            class="rounded-full p-2"
            @click="startViewTransition"
        />
        <template #fallback>
            <div class="size-8" />
        </template>
    </ClientOnly>
</template>

<style>
::view-transition-old(root),
::view-transition-new(root) {
    animation: none;
    mix-blend-mode: normal;
}

::view-transition-new(root) {
    z-index: 9999;
}

::view-transition-old(root) {
    z-index: 1;
}
</style>

<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
    error: {
        type: Object as PropType<NuxtError>,
        default: () => ({
            status: 500,
            statusText: 'Unknown Error',
        }),
    },
})
</script>

<template>
    <UApp>
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <UMain class="flex min-h-dvh w-full flex-col items-center justify-center gap-4">
            <h1 class="font-[Geist] text-9xl leading-none font-extralight text-nowrap">
                {{ props.error.status }}
            </h1>
            <h2 class="text-muted text-lg">
                {{ props.error.statusText }}
            </h2>
            <UButton
                to="/"
                label="Back to Home"
                icon="lucide:arrow-left"
                variant="soft"
                size="lg"
                class="mt-4"
            />
        </UMain>
    </UApp>
</template>

<style>
.page-enter-active,
.page-leave-active {
    transition: all 0.4s;
}
.page-enter-from,
.page-leave-to {
    opacity: 0;
    filter: blur(1rem);
}
</style>

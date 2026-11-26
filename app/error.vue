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

const retryAdminPath = computed(() => {
    const data: unknown = props.error.data
    if (data && typeof data === 'object' && 'retryAdminPath' in data)
        return adminRedirect(data.retryAdminPath)
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
                v-if="retryAdminPath"
                :to="retryAdminPath"
                external
                label="Retry Pocket ID sign-in"
                variant="soft"
                size="lg"
            />
            <UButton
                to="/"
                label="Back to Home"
                icon="mingcute:arrow-left-line"
                variant="soft"
                size="lg"
                class="mt-4"
            />
        </UMain>
    </UApp>
</template>

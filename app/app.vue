<template>
    <UApp>
        <NuxtRouteAnnouncer />
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>

<style>
.page-enter-active,
.page-leave-active {
    transition:
        opacity 200ms cubic-bezier(0.22, 1, 0.36, 1),
        filter 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.page-enter-from,
.page-leave-to {
    opacity: 0;
    filter: blur(0.35rem);
}

@media (prefers-reduced-motion: reduce) {
    .page-enter-active,
    .page-leave-active {
        transition: none;
    }

    .page-enter-from,
    .page-leave-to {
        filter: none;
    }
}
</style>

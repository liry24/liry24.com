<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
const route = useRoute()
const composerId = computed(() =>
    typeof route.query.composer === 'string' &&
    /^[a-zA-Z0-9_-]{1,90}\.\d$/.test(route.query.composer)
        ? route.query.composer
        : undefined,
)
</script>

<template>
    <AdminFormPostEditor :key="composerId ?? 'ordinary'" :composer-id="composerId" />
</template>

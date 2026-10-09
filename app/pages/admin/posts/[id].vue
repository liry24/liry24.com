<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin', key: (route) => route.path })
const id = String(useRoute().params.id)
</script>

<template>
    <AdminFormPostEditor :key="id" :id />
</template>

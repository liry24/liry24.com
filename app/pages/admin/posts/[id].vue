<script setup lang="ts">
definePageMeta({ key: (route) => route.path })

const id = String(useRoute().params.id)
</script>

<template>
    <AdminFormPostEditor :key="id" :id />
</template>

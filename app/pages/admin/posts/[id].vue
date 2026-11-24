<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
useHead({ title: 'Edit Post' })
</script>

<template>
    <AdminPostEditor :key="id" :id="id" />
</template>

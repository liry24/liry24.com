<script setup lang="ts">
definePageMeta({
    title: 'User',
    key: (route) => ('username' in route.params ? String(route.params.username) : route.path),
})
</script>

<template><AdminActivity /></template>

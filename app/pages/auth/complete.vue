<script setup lang="ts">
definePageMeta({ layout: 'minimal' })
const { user, refresh } = useAppSession()
await refresh()
await navigateTo(user.value?.role === 'admin' ? '/admin' : user.value ? '/' : '/login', {
    replace: true,
})
</script>

<template><div /></template>
